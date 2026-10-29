"""Minimal, dependency-free PDF writer (Helvetica, US-Letter, wrapped text).

This produces a real, valid PDF — basic text layout only, honestly so. It is
used for report downloads; no external PDF engine is configured in this
deployment and we do not pretend otherwise.
"""

from __future__ import annotations

PAGE_W, PAGE_H = 612, 792
MARGIN = 54
LINE_H = 14
MAX_LINE_CHARS = 92

_PDF_ESCAPE = str.maketrans({"\\": r"\\", "(": r"\(", ")": r"\)", "\r": " ", "\n": " ", "\t": "  "})


def _wrap(text: str, width: int = MAX_LINE_CHARS) -> list[str]:
    out: list[str] = []
    for raw_line in text.split("\n"):
        if not raw_line.strip():
            out.append("")
            continue
        words, cur = raw_line.split(), ""
        for w in words:
            if len(cur) + len(w) + 1 > width:
                out.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        if cur:
            out.append(cur)
    return out


def _content_stream(sections: list[tuple[str, str]], body_font="F1", mono_font="F2") -> str:
    """Build a multi-page content stream from (heading, body) sections."""
    y = PAGE_H - MARGIN
    pages: list[list[str]] = [[]]

    def new_line(parts: list[str]) -> None:
        pages[-1].append(parts[0])
        y_global[0] -= LINE_H

    y_global = [y]

    def ensure_space() -> None:
        if y_global[0] < MARGIN + LINE_H:
            pages.append([])
            y_global[0] = PAGE_H - MARGIN

    def emit(text: str, font: str, size: float) -> None:
        for line in _wrap(text):
            ensure_space()
            safe = line.translate(_PDF_ESCAPE)
            pages[-1].append(f"BT /{font} {size} Tf {MARGIN} {y_global[0]:.1f} Td ({safe}) Tj ET")
            y_global[0] -= LINE_H

    for heading, body in sections:
        ensure_space()
        y_global[0] -= 4
        emit(heading, "F1", 13)
        emit(body, body_font, 9.5)
        y_global[0] -= 6

    streams = []
    for page in pages:
        streams.append("\n".join(page))
    return streams


def build_pdf(title: str, sections: list[tuple[str, str]]) -> bytes:
    streams = _content_stream(sections)

    def _font_res(fid: str, base: str) -> str:
        return f"<< /Type /Font /Subtype /Type1 /BaseFont /{base} >>"

    objects: list[bytes] = []
    # 1: catalog, 2: pages root, then per-page objects, then fonts, then content streams.
    n_pages = len(streams)
    page_obj_ids = [3 + i for i in range(n_pages)]
    font_ids = {"F1": 3 + n_pages, "F2": 4 + n_pages}
    content_ids = {i: 5 + n_pages + i for i in range(n_pages)}

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode())
    for pid in page_obj_ids:
        i = pid - 3
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Resources << /Font << /F1 {font_ids['F1']} 0 R /F2 {font_ids['F2']} 0 R >> >> "
            f"/Contents {content_ids[i]} 0 R >>".encode()
        )
    objects.append(("<< " + _font_res("F1", "Helvetica") + " >>").encode())
    objects.append(("<< " + _font_res("F2", "Courier") + " >>").encode())
    for _i, stream in enumerate(streams):
        data = stream.encode("latin-1", "replace")
        objects.append(f"<< /Length {len(data)} >>\nstream\n".encode() + data + b"\nendstream")

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{idx} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n").encode()
    return bytes(out)
