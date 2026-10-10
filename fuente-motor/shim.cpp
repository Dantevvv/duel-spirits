// Puente entre ygopro-core y JavaScript (WebAssembly).
#include "ocgapi.h"
#include <cstdlib>
#include <cstring>

#define JS_IMPORT(name) __attribute__((import_module("env"), import_name(#name)))
extern "C" {
JS_IMPORT(js_card_reader) void js_card_reader(uint32_t code, OCG_CardData* data, uint16_t* setcodes, uint32_t max_setcodes);
JS_IMPORT(js_script_reader) int js_script_reader(OCG_Duel duel, const char* name);
JS_IMPORT(js_log) void js_log(const char* s, int type);
}

static constexpr uint32_t MAX_SETCODES = 16;

static void card_reader(void*, uint32_t code, OCG_CardData* data) {
	std::memset(data, 0, sizeof(*data));
	auto* sc = static_cast<uint16_t*>(std::calloc(MAX_SETCODES + 1, sizeof(uint16_t)));
	data->setcodes = sc;
	js_card_reader(code, data, sc, MAX_SETCODES);
}
static void card_reader_done(void*, OCG_CardData* data) { std::free(data->setcodes); data->setcodes = nullptr; }
static int script_reader(void*, OCG_Duel duel, const char* name) { return js_script_reader(duel, name); }
static void log_handler(void*, const char* s, int type) { js_log(s, type); }

static uint32_t last_len = 0;

#define EXPORT(name) extern "C" __attribute__((export_name(#name)))

EXPORT(ygo_malloc) void* ygo_malloc(uint32_t n) { return std::malloc(n); }
EXPORT(ygo_free) void ygo_free(void* p) { std::free(p); }
EXPORT(ygo_last_len) uint32_t ygo_last_len() { return last_len; }

EXPORT(ygo_create_duel) OCG_Duel ygo_create_duel(uint32_t s0, uint32_t s1, uint32_t s2, uint32_t s3, uint32_t flags_lo, uint32_t flags_hi,
	uint32_t lp1, uint32_t lp2, uint32_t start_draw, uint32_t draw_per_turn) {
	OCG_DuelOptions o{};
	o.seed[0] = (uint64_t(s0) << 32) | s1; o.seed[1] = (uint64_t(s1) << 32) | s2;
	o.seed[2] = (uint64_t(s2) << 32) | s3; o.seed[3] = (uint64_t(s3) << 32) | s0 | 1;
	o.flags = (uint64_t(flags_hi) << 32) | flags_lo;
	o.team1 = { lp1, start_draw, draw_per_turn };
	o.team2 = { lp2, start_draw, draw_per_turn };
	o.cardReader = card_reader; o.cardReaderDone = card_reader_done;
	o.scriptReader = script_reader; o.logHandler = log_handler;
	o.enableUnsafeLibraries = 0;
	OCG_Duel d = nullptr;
	int st = OCG_CreateDuel(&d, &o);
	if(st != OCG_DUEL_CREATION_SUCCESS) { last_len = st; return nullptr; }
	return d;
}
EXPORT(ygo_destroy_duel) void ygo_destroy_duel(OCG_Duel d) { OCG_DestroyDuel(d); }
EXPORT(ygo_new_card) void ygo_new_card(OCG_Duel d, uint32_t team, uint32_t duelist, uint32_t code, uint32_t con, uint32_t loc, uint32_t seq, uint32_t pos) {
	OCG_NewCardInfo i{ uint8_t(team), uint8_t(duelist), code, uint8_t(con), loc, seq, pos };
	OCG_DuelNewCard(d, &i);
}
EXPORT(ygo_start_duel) void ygo_start_duel(OCG_Duel d) { OCG_StartDuel(d); }
EXPORT(ygo_process) int ygo_process(OCG_Duel d) { return OCG_DuelProcess(d); }
EXPORT(ygo_get_message) void* ygo_get_message(OCG_Duel d) { return OCG_DuelGetMessage(d, &last_len); }
EXPORT(ygo_set_response) void ygo_set_response(OCG_Duel d, const void* buf, uint32_t len) { OCG_DuelSetResponse(d, buf, len); }
EXPORT(ygo_load_script) int ygo_load_script(OCG_Duel d, const char* buf, uint32_t len, const char* name) { return OCG_LoadScript(d, buf, len, name); }
EXPORT(ygo_query_count) uint32_t ygo_query_count(OCG_Duel d, uint32_t team, uint32_t loc) { return OCG_DuelQueryCount(d, uint8_t(team), loc); }
EXPORT(ygo_query) void* ygo_query(OCG_Duel d, uint32_t flags, uint32_t con, uint32_t loc, uint32_t seq, uint32_t oseq) {
	OCG_QueryInfo q{ flags, uint8_t(con), loc, seq, oseq }; return OCG_DuelQuery(d, &last_len, &q);
}
EXPORT(ygo_query_location) void* ygo_query_location(OCG_Duel d, uint32_t flags, uint32_t con, uint32_t loc) {
	OCG_QueryInfo q{ flags, uint8_t(con), loc, 0, 0 }; return OCG_DuelQueryLocation(d, &last_len, &q);
}
EXPORT(ygo_query_field) void* ygo_query_field(OCG_Duel d) { return OCG_DuelQueryField(d, &last_len); }

// La librería io de Lua solo se abre en modo inseguro (desactivado); stub para el linker.
struct lua_State;
int luaopen_io(lua_State*) { return 0; }
