#!/bin/bash
# Compila ygopro-core + Lua a WebAssembly (wasi-sdk 34, excepciones C++ estándar).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${WASI_SDK:-$HERE/../tools/wasi-sdk-34.0-x86_64-linux}"
CORE="$HERE/../vendor/ygopro-core"
OUT="$HERE/build"; mkdir -p "$OUT/obj"
CXX="$SDK/bin/clang++ --target=wasm32-wasip1 --sysroot=$SDK/share/wasi-sysroot"
FLAGS="-O2 -fwasm-exceptions -mllvm -wasm-use-legacy-eh=false -fno-rtti -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS"
LUA_SKIP="lbitlib.c lcorolib.c ldblib.c linit.c loadlib.c loslib.c ltests.c lua.c luac.c lutf8lib.c onelua.c liolib.c"
objs=()
for f in "$CORE"/lua/src/*.c; do
  b=$(basename "$f"); [[ " $LUA_SKIP " == *" $b "* ]] && continue
  o="$OUT/obj/lua_${b%.c}.o"; objs+=("$o")
  [ "$o" -nt "$f" ] || $CXX $FLAGS -x c++ -std=c++17 -include "$CORE/lua/luaconf-customize.h" -I"$CORE/lua" -c "$f" -o "$o" &
done
wait
for f in "$CORE"/*.cpp "$HERE/shim.cpp"; do
  b=$(basename "$f"); o="$OUT/obj/core_${b%.cpp}.o"; objs+=("$o")
  [ "$o" -nt "$f" ] || $CXX $FLAGS -std=c++17 -I"$CORE" -I"$CORE/lua/src" -c "$f" -o "$o" &
done
wait
$CXX $FLAGS -mexec-model=reactor -Wl,--strip-all -Wl,--export=_initialize -lunwind -lwasi-emulated-signal -lwasi-emulated-process-clocks "${objs[@]}" -o "$OUT/ocgcore.wasm"
ls -la "$OUT/ocgcore.wasm"
