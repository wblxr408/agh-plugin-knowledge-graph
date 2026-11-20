"""Prepare an Obsidian-compatible vault and a private source manifest for Quartz."""

import argparse
import hashlib
import json
import os
import re
from collections import defaultdict
from pathlib import Path, PurePosixPath
from urllib.parse import unquote

import pypdfium2
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation


OFFICE = {".docx", ".pptx", ".xlsx"}
TEXT = {".md", ".txt", ".csv", ".tsv", ".tex", ".rst"}
MAX_BYTES = 100 * 1024 * 1024
MAX_CHARS = 12_000
MAX_PAGES = 8
IGNORE = {".git", "node_modules", "__pycache__"}


def identifier(prefix, value):
    return prefix + hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def note(target, title, body):
    target.write_text(f"---\ntitle: {json.dumps(title, ensure_ascii=False)}\n---\n\n{body}\n",
                      encoding="utf-8")


def office_text(path, suffix):
    if suffix == ".docx":
        document = Document(path)
        yield from (paragraph.text for paragraph in document.paragraphs)
        for table in document.tables:
            for row in table.rows:
                yield " · ".join(cell.text for cell in row.cells)
    elif suffix == ".pptx":
        for number, slide in enumerate(Presentation(path).slides, 1):
            yield f"第 {number} 页"
            for shape in slide.shapes:
                if shape.has_text_frame:
                    yield shape.text
                if shape.has_table:
                    for row in shape.table.rows:
                        yield " · ".join(cell.text for cell in row.cells)
    else:
        workbook = load_workbook(path, read_only=True, data_only=True)
        try:
            for sheet in workbook:
                yield sheet.title
                for row in sheet.values:
                    yield " · ".join(str(value) for value in row if value is not None)
        finally:
            workbook.close()


def excerpt(path):
    suffix = path.suffix.lower()
    if suffix not in OFFICE | TEXT | {".pdf"}:
        return "", "metadata"
    if path.stat().st_size > MAX_BYTES:
        return "", "limited"
    if suffix in TEXT:
        with path.open("rb") as src:
            raw = src.read(MAX_CHARS * 4)
        for encoding in ("utf-8-sig", "gb18030"):
            try:
                text = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                text = ""
    elif suffix == ".pdf":
        pdf = pypdfium2.PdfDocument(path)
        try:
            samples = []
            for number in range(min(len(pdf), MAX_PAGES)):
                page = pdf[number]
                try:
                    layer = page.get_textpage()
                    try:
                        samples.append(layer.get_text_bounded())
                    finally:
                        layer.close()
                finally:
                    page.close()
                if sum(map(len, samples)) >= MAX_CHARS:
                    break
            text = "\n\n".join(samples)
        finally:
            pdf.close()
    else:
        pieces = []
        size = 0
        for piece in office_text(path, suffix):
            pieces.append(piece)
            size += len(piece) + 1
            if size >= MAX_CHARS:
                break
        text = "\n".join(pieces)
    text = text.replace("\x00", "").strip()
    if suffix == ".md":
        text = re.sub(r"\A---\s*\n[\s\S]*?\n---\s*\n", "", text, count=1)
    return text[:MAX_CHARS], "text" if text else "empty"


def source_links(text, rel, ids, names):
    def resolve(raw):
        raw = unquote(raw.strip().strip("<>").split("#", 1)[0]).replace("\\", "/")
        if not raw or ":" in raw or raw.startswith("//"):
            return None
        local = str(PurePosixPath(os.path.normpath(str(rel.parent / raw)).replace("\\", "/")))
        for candidate in (local, local + ".md", raw.lstrip("/"), raw.lstrip("/") + ".md"):
            if candidate in ids:
                return ids[candidate]
        exact = names.get(PurePosixPath(raw).stem.casefold(), [])
        return exact[0] if len(exact) == 1 else None

    def wiki(match):
        target, _, alias = match[1].partition("|")
        linked = resolve(target)
        return f"[[{linked}|{alias or target}]]" if linked else match[0]

    def markdown(match):
        linked = resolve(match[2])
        return f"[[{linked}|{match[1]}]]" if linked else match[0]

    text = re.sub(r"(?<!!)\[\[([^\]\r\n]+)\]\]", wiki, text)
    return re.sub(r"(?<!!)\[([^\]\r\n]+)\]\(([^)\r\n]+)\)", markdown, text)


def stage(source, output):
    vault = output / "vault"
    vault.mkdir(parents=True)
    files = []
    for parent, dirs, names in os.walk(source, followlinks=False):
        dirs[:] = sorted(name for name in dirs if name not in IGNORE
                         and not (Path(parent) / name).is_symlink())
        for name in sorted(names):
            item = Path(parent) / name
            if not item.is_symlink() and item.is_file():
                files.append((item, PurePosixPath(item.relative_to(source).as_posix())))
    ids = {str(rel): identifier("n-", str(rel)) for _, rel in files}
    names = defaultdict(list)
    groups = defaultdict(list)
    visited = set()
    sources = {}
    for _, rel in files:
        names[rel.stem.casefold()].append(ids[str(rel)])
    for number, (item, rel) in enumerate(files, 1):
        key = ids[str(rel)]
        parent = str(rel.parent)
        while parent != ".":
            group = identifier("g-", parent)
            if parent not in visited:
                above = str(PurePosixPath(parent).parent)
                groups[above].append(group)
                visited.add(parent)
            if parent == str(rel.parent):
                groups[parent].append(key)
            parent = str(PurePosixPath(parent).parent)
        if str(rel.parent) == ".":
            groups["."].append(key)
        try:
            text, state = excerpt(item)
        except Exception:
            text, state = "", "error"
        if rel.suffix.lower() == ".md":
            text = source_links(text, rel, ids, names)
        note(vault / f"{key}.md", rel.name, text or "已收录文件来源。")
        sources[key] = {"path": str(rel), "state": state, "text": text}
        if number % 300 == 0:
            print(f"已整理 {number}/{len(files)} 份资料", flush=True)

    for parent, children in groups.items():
        key = "index" if parent == "." else identifier("g-", parent)
        title = source.name if parent == "." else PurePosixPath(parent).name
        body = "\n".join(f"- [[{child}]]" for child in dict.fromkeys(children))
        note(vault / f"{key}.md", title, body)
        sources[key] = {"path": "" if parent == "." else parent, "state": "folder"}
    if "." not in groups:
        note(vault / "index.md", source.name, "目录暂无资料。")
        sources["index"] = {"path": "", "state": "folder"}
    (output / "sources.json").write_text(json.dumps(sources, ensure_ascii=False), encoding="utf-8")
    print(f"已整理 {len(files)} 份资料，开始交给 Quartz 解析链接。", flush=True)


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("source", type=Path)
    args.add_argument("output", type=Path)
    config = args.parse_args()
    if not config.source.is_dir():
        args.error("source must be an existing directory")
    stage(config.source.resolve(), config.output.resolve())
