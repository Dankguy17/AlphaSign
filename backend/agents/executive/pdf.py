"""Minimal PDF report writer for the executive agent."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import textwrap


@dataclass(frozen=True)
class ReportSection:
    title: str
    body: str


def write_pdf_report(path: Path, title: str, subtitle: str, sections: list[ReportSection]) -> Path:
    """Write a readable multi-page PDF using only the Python stdlib."""

    path.parent.mkdir(parents=True, exist_ok=True)
    pages = _paginate(title, subtitle, sections)
    objects: list[bytes] = []

    def add_object(data: bytes) -> int:
        objects.append(data)
        return len(objects)

    font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    page_ids: list[int] = []

    for page in pages:
        stream = _page_stream(page)
        content_id = add_object(
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"
        )
        page_id = add_object(
            (
                "<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode("ascii")
        )
        page_ids.append(page_id)

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    pages_id = add_object(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii"))

    for page_id in page_ids:
        objects[page_id - 1] = objects[page_id - 1].replace(b"/Parent 0 0 R", f"/Parent {pages_id} 0 R".encode("ascii"))

    catalog_id = add_object(f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("ascii"))

    content = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content.extend(f"{index} 0 obj\n".encode("ascii"))
        content.extend(obj)
        content.extend(b"\nendobj\n")

    xref_offset = len(content)
    content.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    content.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        content.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    content.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )

    path.write_bytes(bytes(content))
    return path


def _paginate(title: str, subtitle: str, sections: list[ReportSection]) -> list[list[tuple[str, str]]]:
    rows: list[tuple[str, str]] = [("title", title), ("subtitle", subtitle), ("space", "")]
    for section in sections:
        rows.append(("heading", section.title))
        for paragraph in section.body.splitlines() or [""]:
            if not paragraph.strip():
                rows.append(("space", ""))
                continue
            for line in textwrap.wrap(paragraph, width=92, break_long_words=False):
                rows.append(("body", line))
        rows.append(("space", ""))

    pages: list[list[tuple[str, str]]] = []
    current: list[tuple[str, str]] = []
    y = 742
    for row in rows:
        style = row[0]
        line_height = {"title": 28, "subtitle": 20, "heading": 22, "body": 14, "space": 10}[style]
        if current and y - line_height < 54:
            pages.append(current)
            current = []
            y = 742
        current.append(row)
        y -= line_height
    if current:
        pages.append(current)
    return pages


def _page_stream(rows: list[tuple[str, str]]) -> bytes:
    commands = ["BT", "50 742 Td"]
    y = 742
    previous_y = 742

    for style, text in rows:
        font_size = {"title": 20, "subtitle": 11, "heading": 14, "body": 10, "space": 10}[style]
        line_height = {"title": 28, "subtitle": 20, "heading": 22, "body": 14, "space": 10}[style]
        next_y = y if not commands or y == previous_y else y
        if next_y != previous_y:
            commands.append(f"0 {next_y - previous_y} Td")
        commands.append(f"/F1 {font_size} Tf")
        if text:
            commands.append(f"({_escape_pdf_text(text)}) Tj")
        y -= line_height
        previous_y = next_y

    commands.append("ET")
    return "\n".join(commands).encode("latin-1", errors="replace")


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
