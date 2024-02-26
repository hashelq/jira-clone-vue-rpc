{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell rec {
  buildInputs = with pkgs; [ gnumake pkg-config stdenv.cc.cc.lib ];
  LD_LIBRARY_PATH = "$LD_LIBRARY_PATH:${builtins.toString (pkgs.lib.makeLibraryPath buildInputs)} ";
  LD_PRELOAD="${pkgs.stdenv.cc.cc.lib}/lib/libstdc++.so.6";
}
