// Portado de ocgcore-wasm (MIT, Simone Miraglia)
import { OcgAttribute, OcgLocation, OcgPosition, OcgRace } from "./type_core.js";

export var OcgResponseType = /*#__PURE__*/ function(OcgResponseType) {
    OcgResponseType[OcgResponseType["SELECT_BATTLECMD"] = 0] = "SELECT_BATTLECMD";
    OcgResponseType[OcgResponseType["SELECT_IDLECMD"] = 1] = "SELECT_IDLECMD";
    OcgResponseType[OcgResponseType["SELECT_EFFECTYN"] = 2] = "SELECT_EFFECTYN";
    OcgResponseType[OcgResponseType["SELECT_YESNO"] = 3] = "SELECT_YESNO";
    OcgResponseType[OcgResponseType["SELECT_OPTION"] = 4] = "SELECT_OPTION";
    OcgResponseType[OcgResponseType["SELECT_CARD"] = 5] = "SELECT_CARD";
    OcgResponseType[OcgResponseType["SELECT_CARD_CODES"] = 6] = "SELECT_CARD_CODES";
    OcgResponseType[OcgResponseType["SELECT_UNSELECT_CARD"] = 7] = "SELECT_UNSELECT_CARD";
    OcgResponseType[OcgResponseType["SELECT_CHAIN"] = 8] = "SELECT_CHAIN";
    OcgResponseType[OcgResponseType["SELECT_DISFIELD"] = 9] = "SELECT_DISFIELD";
    OcgResponseType[OcgResponseType["SELECT_PLACE"] = 10] = "SELECT_PLACE";
    OcgResponseType[OcgResponseType["SELECT_POSITION"] = 11] = "SELECT_POSITION";
    OcgResponseType[OcgResponseType["SELECT_TRIBUTE"] = 12] = "SELECT_TRIBUTE";
    OcgResponseType[OcgResponseType["SELECT_COUNTER"] = 13] = "SELECT_COUNTER";
    OcgResponseType[OcgResponseType["SELECT_SUM"] = 14] = "SELECT_SUM";
    OcgResponseType[OcgResponseType["SORT_CARD"] = 15] = "SORT_CARD";
    OcgResponseType[OcgResponseType["ANNOUNCE_RACE"] = 16] = "ANNOUNCE_RACE";
    OcgResponseType[OcgResponseType["ANNOUNCE_ATTRIB"] = 17] = "ANNOUNCE_ATTRIB";
    OcgResponseType[OcgResponseType["ANNOUNCE_CARD"] = 18] = "ANNOUNCE_CARD";
    OcgResponseType[OcgResponseType["ANNOUNCE_NUMBER"] = 19] = "ANNOUNCE_NUMBER";
    OcgResponseType[OcgResponseType["ROCK_PAPER_SCISSORS"] = 20] = "ROCK_PAPER_SCISSORS";
    return OcgResponseType;
}({});
export var SelectBattleCMDAction = /*#__PURE__*/ function(SelectBattleCMDAction) {
    SelectBattleCMDAction[SelectBattleCMDAction["SELECT_CHAIN"] = 0] = "SELECT_CHAIN";
    SelectBattleCMDAction[SelectBattleCMDAction["SELECT_BATTLE"] = 1] = "SELECT_BATTLE";
    SelectBattleCMDAction[SelectBattleCMDAction["TO_M2"] = 2] = "TO_M2";
    SelectBattleCMDAction[SelectBattleCMDAction["TO_EP"] = 3] = "TO_EP";
    return SelectBattleCMDAction;
}({});
export var SelectIdleCMDAction = /*#__PURE__*/ function(SelectIdleCMDAction) {
    SelectIdleCMDAction[SelectIdleCMDAction["SELECT_SUMMON"] = 0] = "SELECT_SUMMON";
    SelectIdleCMDAction[SelectIdleCMDAction["SELECT_SPECIAL_SUMMON"] = 1] = "SELECT_SPECIAL_SUMMON";
    SelectIdleCMDAction[SelectIdleCMDAction["SELECT_POS_CHANGE"] = 2] = "SELECT_POS_CHANGE";
    SelectIdleCMDAction[SelectIdleCMDAction["SELECT_MONSTER_SET"] = 3] = "SELECT_MONSTER_SET";
    SelectIdleCMDAction[SelectIdleCMDAction["SELECT_SPELL_SET"] = 4] = "SELECT_SPELL_SET";
    SelectIdleCMDAction[SelectIdleCMDAction["SELECT_ACTIVATE"] = 5] = "SELECT_ACTIVATE";
    SelectIdleCMDAction[SelectIdleCMDAction["TO_BP"] = 6] = "TO_BP";
    SelectIdleCMDAction[SelectIdleCMDAction["TO_EP"] = 7] = "TO_EP";
    SelectIdleCMDAction[SelectIdleCMDAction["SHUFFLE"] = 8] = "SHUFFLE";
    return SelectIdleCMDAction;
}({});
