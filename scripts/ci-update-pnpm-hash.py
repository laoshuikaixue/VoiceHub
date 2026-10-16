#!/usr/bin/env python3
"""读写 flake.nix 中 pnpmDeps 哈希，仅供 Nix CI 调用。"""

import argparse
import sys
from pathlib import Path

# 锚定仓库根目录，避免依赖调用方 CWD
FLAKE = Path(__file__).resolve().parent.parent / "flake.nix"
MARKER = "pnpmDeps = pkgs.fetchPnpmDeps {"


def split_hash(text):
    start = text.index(MARKER)
    key = 'hash = "'
    hash_start = text.index(key, start) + len(key)
    hash_end = text.index('"', hash_start)
    return text[:hash_start], text[hash_start:hash_end], text[hash_end:]


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--empty", action="store_true", help="置空哈希，以便从构建报错中提取真实值")
    group.add_argument("--set", metavar="HASH", help="写回新的哈希值")
    args = parser.parse_args()

    try:
        head, current, tail = split_hash(FLAKE.read_text(encoding="utf-8"))
    except ValueError as error:
        print(f"未在 flake.nix 中定位 pnpmDeps 哈希: {error}", file=sys.stderr)
        return 1

    if args.empty:
        FLAKE.write_text(head + tail, encoding="utf-8")
    else:
        if not args.set.startswith("sha256-"):
            print(f"哈希格式非法: {args.set}", file=sys.stderr)
            return 1
        if args.set == current:
            print("哈希与现有值相同，无需写回")
            return 0
        FLAKE.write_text(head + args.set + tail, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
