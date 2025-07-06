/**
 * Targeting Rules Engine for BG3 Inspired Hotbar
 * Determines which items require targeting and extracts their requirements
 */

/**
 * Check if an item requires targeting
 * @param {Item} item - The item to check
 * @returns {boolean} - True if the item needs targeting
 */
export function needsTargeting(item) {
    if (!item) return false;
    
    // Check if targeting is explicitly disabled
    if (item.system?.target?.type === "self" || item.system?.target?.type === "none") {
        return false;
    }
    
    // Check for AOE template spells that target points - these should use Foundry's template system
    if (isAOETemplateSpell(item)) {
        return false;
    }
    
    // Check for target configuration in item system
    if (item.system?.target?.type && item.system.target.type !== "self") {
        return true;
    }
    
    // Check activities for targeting requirements (Foundry v12+)
    if (item.system?.activities) {
        for (const activity of item.system.activities.values()) {
            if (activity.target?.type && activity.target.type !== "self" && activity.target.type !== "none") {
                return true;
            }
        }
    }
    
    // Check for attack rolls (weapons, attack spells)
    if (item.system?.actionType === "attack" || item.system?.actionType === "rsak" || item.system?.actionType === "msak") {
        return true;
    }
    
    // Check for saving throws (most spells that affect others)
    if (item.system?.actionType === "save" && item.system?.target?.type !== "self") {
        return true;
    }
    
    // Check for specific spell properties
    if (item.type === "spell") {
        const target = item.system?.target;
        if (target?.type && !["self", "none"].includes(target.type)) {
            return true;
        }
        
        // Check spell range - if it has a range other than self/touch, it likely needs targeting
        const range = item.system?.range;
        if (range?.value && range.value > 0 && range.units !== "self" && range.units !== "touch") {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if an item is an AOE template spell that targets a point (should use Foundry's template system)
 * @param {Item} item - The item to check
 * @returns {boolean} - True if the item is an AOE template spell
 */
function isAOETemplateSpell(item) {
    // Check primary target configuration for AOE template
    if (item.system?.target?.template) {
        const templateType = item.system.target.template.type;
        // These template types target points, not creatures
        if (["cone", "cube", "cylinder", "line", "radius", "sphere"].includes(templateType)) {
            return true;
        }
    }
    
    // Check activities for AOE template (Foundry v12+)
    if (item.system?.activities) {
        for (const activity of item.system.activities.values()) {
            if (activity.target?.template) {
                const templateType = activity.target.template.type;
                // These template types target points, not creatures
                if (["cone", "cube", "cylinder", "line", "radius", "sphere"].includes(templateType)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

/**
 * Extract targeting requirements from an item
 * @param {Item} item - The item to analyze
 * @returns {Object} - Targeting requirements object
 */
export function getTargetRequirements(item) {
    if (!item) return {};
    
    const requirements = {
        minTargets: 1,
        maxTargets: 1,
        range: null,
        type: null,
        template: null
    };
    
    // Primary target configuration
    let targetConfig = item.system?.target;
    
    // Check activities for more specific targeting (Foundry v12+)
    if (item.system?.activities) {
        for (const activity of item.system.activities.values()) {
            if (activity.target?.type && activity.target.type !== "self") {
                targetConfig = activity.target;
                break; // Use first valid activity target
            }
        }
    }
    
    if (targetConfig) {
        // Target count
        if (targetConfig.value) {
            requirements.maxTargets = parseInt(targetConfig.value) || 1;
            requirements.minTargets = Math.min(requirements.maxTargets, 1);
        }
        
        // Target type
        requirements.type = targetConfig.type;
        
        // Template information
        if (targetConfig.template) {
            requirements.template = {
                type: targetConfig.template.type,
                size: targetConfig.template.size,
                units: targetConfig.template.units
            };
        }
    }
    
    // Range calculation
    requirements.range = calculateRange(item);
    
    // Special handling for different item types
    let enhancedRequirements = requirements;
    switch (item.type) {
        case "spell":
            enhancedRequirements = enhanceSpellTargeting(item, requirements);
            break;
        case "weapon":
            enhancedRequirements = enhanceWeaponTargeting(item, requirements);
            break;
        case "feat":
            enhancedRequirements = enhanceFeatureTargeting(item, requirements);
            break;
    }
    
    return enhancedRequirements;
}

/**
 * Calculate the effective range of an item
 * @param {Item} item - The item to analyze
 * @returns {number|null} - Range in scene units, or null if unlimited/special
 */
function calculateRange(item) {
    let range = item.system?.range;
    
    // Check activities for range (Foundry v12+)
    if (item.system?.activities) {
        for (const activity of item.system.activities.values()) {
            if (activity.range?.value) {
                range = activity.range;
                break;
            }
        }
    }
    
    if (!range) return null;
    
    // Check for special ranges that don't need calculation
    switch (range.units) {
        case "self":
        case "touch":
            return canvas.scene.grid.distance || 5; // Touch range = 1 grid square distance
        case "sight":
        case "unlimited":
        case "special":
            return null; // No range limit
    }
    
    const rangeValue = range.value || 0;
    if (rangeValue <= 0) return null;
    
    // Get scene units
    const gridUnits = canvas.scene.grid.units || "ft";
    
    // Convert the item's range to the scene's units if needed
    let rangeInSceneUnits = rangeValue;
    if (range.units !== gridUnits) {
        rangeInSceneUnits = convertRangeUnits(rangeValue, range.units, gridUnits);
    }
    
    // Debug logging
    console.log(`BG3 Target Selector | Range calculation for ${item.name}:`, {
        originalRange: `${rangeValue} ${range.units}`,
        sceneUnits: gridUnits,
        rangeInSceneUnits: rangeInSceneUnits
    });
    
    return rangeInSceneUnits;
}

/**
 * Convert range between different units
 * @param {number} value - The range value
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {number} - Converted value
 */
function convertRangeUnits(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    
    // Convert to feet first (as base unit)
    let feet = value;
    switch (fromUnit) {
        case "ft":
            break; // Already in feet
        case "mi":
            feet *= 5280;
            break;
        case "km":
            feet *= 3280.84;
            break;
        case "m":
            feet *= 3.28084;
            break;
        default:
            // Unknown unit, assume feet
            break;
    }
    
    // Convert from feet to target unit
    switch (toUnit) {
        case "ft":
            return feet;
        case "mi":
            return feet / 5280;
        case "km":
            return feet / 3280.84;
        case "m":
            return feet / 3.28084;
        default:
            return feet; // Default to feet
    }
}

/**
 * Enhance targeting requirements for spells
 * @param {Item} spell - The spell item
 * @param {Object} requirements - Base requirements
 * @returns {Object} - Enhanced requirements
 */
function enhanceSpellTargeting(spell, requirements) {
    const enhanced = { ...requirements };
    
    // Check for area of effect spells
    if (spell.system?.target?.template) {
        enhanced.template = {
            type: spell.system.target.template.type,
            size: spell.system.target.template.size,
            units: spell.system.target.template.units || "ft"
        };
        
        // Area spells typically target a point, not creatures directly
        if (["cone", "cube", "cylinder", "line", "radius", "sphere"].includes(enhanced.template.type)) {
            enhanced.type = "point";
            enhanced.minTargets = 1;
            enhanced.maxTargets = 1;
        }
    }
    
    // Handle multi-target spells
    if (spell.system?.target?.value > 1) {
        enhanced.maxTargets = spell.system.target.value;
        enhanced.minTargets = Math.min(enhanced.maxTargets, enhanced.minTargets);
    }
    
    // Special spell targeting rules
    const spellName = spell.name.toLowerCase();
    if (spellName.includes("magic missile")) {
        enhanced.maxTargets = 3; // Can target up to 3 creatures
        enhanced.minTargets = 1;
    }
    
    return enhanced;
}

/**
 * Enhance targeting requirements for weapons
 * @param {Item} weapon - The weapon item
 * @param {Object} requirements - Base requirements
 * @returns {Object} - Enhanced requirements
 */
function enhanceWeaponTargeting(weapon, requirements) {
    const enhanced = { ...requirements };
    
    // Melee weapons have short range
    if (weapon.system?.actionType === "mwak") {
        enhanced.range = weapon.system?.properties?.has("reach") ? 10 : 5;
        enhanced.type = "creature";
    }
    
    // Ranged weapons use their range
    if (weapon.system?.actionType === "rwak") {
        const range = weapon.system?.range;
        if (range?.long) {
            enhanced.range = range.long;
        } else if (range?.value) {
            enhanced.range = range.value;
        }
        enhanced.type = "creature";
    }
    
    return enhanced;
}

/**
 * Enhance targeting requirements for features/feats
 * @param {Item} feature - The feature item
 * @param {Object} requirements - Base requirements
 * @returns {Object} - Enhanced requirements
 */
function enhanceFeatureTargeting(feature, requirements) {
    const enhanced = { ...requirements };
    
    // Most features that need targeting are similar to spells
    if (feature.system?.actionType === "save") {
        enhanced.type = "creature";
    }
    
    if (feature.system?.actionType === "attack") {
        enhanced.type = "creature";
        enhanced.range = enhanced.range || 5; // Default melee range
    }
    
    return enhanced;
}

/**
 * Validate if selected targets meet the item's requirements
 * @param {Item} item - The item being used
 * @param {Token[]} targets - Selected targets
 * @returns {Object} - Validation result with success boolean and error message
 */
export function validateTargets(item, targets) {
    const requirements = getTargetRequirements(item);
    
    // Check target count (only enforce minimum, let players decide maximum)
    if (targets.length < requirements.minTargets) {
        return {
            success: false,
            error: `Must select at least ${requirements.minTargets} target(s)`
        };
    }
    
    // No maximum target validation - let players decide based on spell level/scaling
    
    // Check range for each target
    if (requirements.range) {
        const sourceToken = ui.BG3HOTBAR.manager.token;
        if (sourceToken) {
            for (const target of targets) {
                const distance = canvas.grid.measureDistance(
                    sourceToken.center,
                    target.center,
                    { gridSpaces: true }
                );
                
                if (distance > requirements.range) {
                    return {
                        success: false,
                        error: `Target ${target.name} is out of range (${Math.round(distance)}ft > ${requirements.range}ft)`
                    };
                }
            }
        }
    }
    
    // Check target type requirements
    if (requirements.type && requirements.type !== "point") {
        for (const target of targets) {
            if (!isValidTargetType(target, requirements.type, ui.BG3HOTBAR.manager.token)) {
                return {
                    success: false,
                    error: `${target.name} is not a valid target for this ${item.type}`
                };
            }
        }
    }
    
    return { success: true };
}

/**
 * Check if a target meets the type requirements
 * @param {Token} target - Target token
 * @param {string} requiredType - Required target type
 * @param {Token} sourceToken - Source token
 * @returns {boolean} - True if target is valid
 */
function isValidTargetType(target, requiredType, sourceToken) {
    if (!target?.actor) return false;
    
    switch (requiredType.toLowerCase()) {
        case "self":
            return target === sourceToken;
        case "ally":
            return target.actor && sourceToken?.actor && 
                   target.actor.system.details?.alignment === sourceToken.actor.system.details?.alignment;
        case "enemy":
            return target.actor && sourceToken?.actor && 
                   target.actor.system.details?.alignment !== sourceToken.actor.system.details?.alignment;
        case "creature":
            return target.actor && (target.actor.type === "character" || target.actor.type === "npc");
        case "object":
            return !target.actor; // Tokens without actors are typically objects
        default:
            return true; // Unknown type, allow all
    }
} 