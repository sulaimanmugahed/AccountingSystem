#!/usr/bin/env python3
"""
Build an Arabic, right-to-left PDF from the accounting guide Markdown.

Usage
-----
    pip install fpdf2 uharfbuzz
    python docs/build-guide-pdf.py

Fonts
-----
The guide is set in Amiri (Arabic) with DejaVu Sans Mono for code. Amiri is
looked up in, in order:

    1. $AMIRI_REGULAR / $AMIRI_BOLD environment variables
    2. docs/fonts/Amiri-Regular.ttf + Amiri-Bold.ttf
    3. /tmp/fonts/... (where the helper below downloads them)
    4. fetched with `npm pack @expo-google-fonts/amiri` into /tmp/fonts

Only the generated PDF and this script live in the repository; the font files
are cached outside it.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from fpdf import FPDF

DOCS = Path(__file__).resolve().parent
SOURCE = DOCS / "دليل-المحاسبة-بالعربية.md"
OUTPUT = DOCS / "دليل-المحاسبة-بالعربية.pdf"

# ---------------------------------------------------------------- palette ----
BRAND = (15, 118, 110)
BRAND_DARK = (19, 78, 74)
INK = (27, 36, 48)
MUTED = (91, 107, 124)
LINE = (226, 232, 240)
TABLE_HEAD = (241, 245, 249)
ZEBRA = (251, 252, 254)
QUOTE_BG = (255, 251, 235)
QUOTE_BAR = (180, 83, 9)
QUOTE_INK = (124, 45, 18)
CODE_BG = (15, 23, 42)
CODE_INK = (226, 232, 240)

PAGE_W, PAGE_H = 210.0, 297.0
MARGIN = 16.0
CONTENT_W = PAGE_W - 2 * MARGIN

# Characters Amiri cannot draw; map them to Arabic-friendly equivalents.
REPLACEMENTS = {
    "←": "‹",
    "→": "›",
    "↔": "‹›",
    "✓": "√",
    "✔": "√",
    "✗": "×",
    "≈": "≈" if False else "~",
    "≤": "<=",
    "≥": ">=",
    "≠": "!=",
    "▪": "-",
    "◦": "-",
    "\u200e": "",
    "\u200f": "",
    "🎉": "",
}

INLINE_CODE = re.compile(r"`([^`]*)`")
LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")


# ------------------------------------------------------------------ fonts ----
def _amiri_from_npm(target: Path) -> bool:
    """Fetch Amiri with the npm client that is already available in this repo."""
    target.mkdir(parents=True, exist_ok=True)
    if (target / "Amiri-Regular.ttf").exists() and (target / "Amiri-Bold.ttf").exists():
        return True
    if shutil.which("npm") is None:
        return False
    with tempfile.TemporaryDirectory() as tmp:
        try:
            subprocess.run(
                ["npm", "pack", "@expo-google-fonts/amiri"],
                cwd=tmp,
                check=True,
                capture_output=True,
            )
            tarball = next(Path(tmp).glob("*.tgz"))
            subprocess.run(["tar", "xzf", str(tarball)], cwd=tmp, check=True)
        except (subprocess.CalledProcessError, StopIteration):
            return False
        faces = {
            "package/400Regular/Amiri_400Regular.ttf": "Amiri-Regular.ttf",
            "package/700Bold/Amiri_700Bold.ttf": "Amiri-Bold.ttf",
            "package/400Regular_Italic/Amiri_400Regular_Italic.ttf": "Amiri-Italic.ttf",
            "package/700Bold_Italic/Amiri_700Bold_Italic.ttf": "Amiri-BoldItalic.ttf",
        }
        for source, name in faces.items():
            face = Path(tmp) / source
            if face.exists():
                shutil.copy(face, target / name)
    return True


def resolve_fonts() -> tuple[Path, Path, Path, Path, Path, Path]:
    candidates = [
        Path(os.environ.get("AMIRI_REGULAR", "")) if os.environ.get("AMIRI_REGULAR") else None,
        DOCS / "fonts" / "Amiri-Regular.ttf",
        Path("/tmp/fonts/Amiri-Regular.ttf"),
    ]
    regular = next((p for p in candidates if p and p.exists()), None)
    if regular is None:
        if not _amiri_from_npm(Path("/tmp/fonts")):
            sys.exit(
                "Amiri font not found. Install it with:\n"
                "  npm pack @expo-google-fonts/amiri && tar xzf *.tgz\n"
                "  cp package/400Regular/Amiri_400Regular.ttf /tmp/fonts/Amiri-Regular.ttf\n"
                "  cp package/700Bold/Amiri_700Bold.ttf       /tmp/fonts/Amiri-Bold.ttf\n"
                "or point AMIRI_REGULAR / AMIRI_BOLD at the files."
            )
        regular = Path("/tmp/fonts/Amiri-Regular.ttf")

    bold = Path(os.environ.get("AMIRI_BOLD", "")) if os.environ.get("AMIRI_BOLD") else regular.with_name("Amiri-Bold.ttf")
    if not bold.exists():
        bold = regular

    mono = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
    mono_bold = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf")
    if not mono.exists():
        mono = regular
        mono_bold = bold
    if not mono_bold.exists():
        mono_bold = mono

    italic = regular.with_name("Amiri-Italic.ttf")
    bold_italic = regular.with_name("Amiri-BoldItalic.ttf")
    return (
        regular,
        bold,
        italic if italic.exists() else bold,
        bold_italic if bold_italic.exists() else bold,
        mono,
        mono_bold,
    )


# --------------------------------------------------------------- markdown ----
def sanitize(text: str) -> str:
    for source, replacement in REPLACEMENTS.items():
        text = text.replace(source, replacement)
    text = text.replace("\u00a0", " ")
    return text


def plain(text: str) -> str:
    """Strip inline markdown so the text can be laid out as a single run."""
    text = LINK.sub(r"\1", text)
    text = INLINE_CODE.sub(r"\1", text)
    text = text.replace("**", "").replace("__", "")
    return sanitize(re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"\1", text))


BOLD = re.compile(r"\*\*([^*\n]+)\*\*")
ITALIC = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")


def inline(text: str) -> str:
    """Translate Markdown emphasis into the syntax fpdf2 understands."""
    text = LINK.sub(r"\1", text)
    text = INLINE_CODE.sub(r"\1", text)
    text = text.replace("**", "\x00").replace("*", "\x01").replace("\x00", "**").replace("\x01", "*")
    # fpdf2 renders **bold** and __italic__ / --underline--
    text = BOLD.sub(lambda m: "**" + m.group(1) + "**", text)
    text = ITALIC.sub(lambda m: "__" + m.group(1) + "__", text)
    return sanitize(text)


def split_table_row(line: str) -> list[str]:
    cells = line.strip().strip("|").split("|")
    return [cell.strip() for cell in cells]


def is_separator_row(line: str) -> bool:
    return bool(re.fullmatch(r"\|[\s:\-|]+\|", line.strip()))


class Blocks:
    """Turn the Markdown source into a flat list of renderable blocks."""

    def __init__(self, text: str) -> None:
        self.lines = text.split("\n")
        self.blocks: list[tuple] = []

    def parse(self) -> list[tuple]:
        i = 0
        lines = self.lines
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            if not stripped:
                i += 1
                continue

            if stripped.startswith("```"):
                i += 1
                body: list[str] = []
                while i < len(lines) and not lines[i].strip().startswith("```"):
                    body.append(lines[i])
                    i += 1
                i += 1
                self.blocks.append(("code", body))
                continue

            heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
            if heading:
                self.blocks.append(("h", len(heading.group(1)), heading.group(2)))
                i += 1
                continue

            if re.fullmatch(r"-{3,}|\*{3,}", stripped):
                self.blocks.append(("hr",))
                i += 1
                continue

            if stripped.startswith("|"):
                rows: list[list[str]] = []
                while i < len(lines) and lines[i].strip().startswith("|"):
                    if not is_separator_row(lines[i]):
                        rows.append(split_table_row(lines[i]))
                    i += 1
                self.blocks.append(("table", rows))
                continue

            if stripped.startswith(">"):
                quote: list[str] = []
                while i < len(lines) and lines[i].strip().startswith(">"):
                    quote.append(lines[i].strip().lstrip(">").strip())
                    i += 1
                self.blocks.append(("quote", quote))
                continue

            bullet = re.match(r"^[-*]\s+(.*)$", stripped)
            if bullet:
                items: list[str] = []
                while i < len(lines):
                    match = re.match(r"^[-*]\s+(.*)$", lines[i].strip())
                    if not match:
                        break
                    items.append(match.group(1))
                    i += 1
                self.blocks.append(("ul", items))
                continue

            ordered = re.match(r"^\d+[.)]\s+(.*)$", stripped)
            if ordered:
                items = []
                while i < len(lines):
                    match = re.match(r"^\d+[.)]\s+(.*)$", lines[i].strip())
                    if not match:
                        break
                    items.append(match.group(1))
                    i += 1
                self.blocks.append(("ol", items))
                continue

            paragraph: list[str] = []
            while i < len(lines) and lines[i].strip() and not re.match(
                r"^(#|\||>|```|\d+[.)]\s|[-*]\s)", lines[i].strip()
            ):
                paragraph.append(lines[i].strip())
                i += 1
            self.blocks.append(("p", " ".join(paragraph)))

        return self.blocks


# -------------------------------------------------------------- the writer ---
class GuidePDF(FPDF):
    def footer(self) -> None:
        if self.page_no() == 1:
            return
        self.set_y(-14)
        self.set_font("Amiri", "", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 6, sanitize(f"دليل المحاسبة ونظام Ledgerly — صفحة {self.page_no()}"), align="C")


class Renderer:
    def __init__(
        self,
        regular: Path,
        bold: Path,
        italic: Path,
        bold_italic: Path,
        mono: Path,
        mono_bold: Path,
    ) -> None:
        self.pdf = GuidePDF(format="A4")
        self.pdf.set_margins(MARGIN, 14, MARGIN)
        self.pdf.set_auto_page_break(True, 20)
        self.pdf.set_text_shaping(True)

        self.pdf.add_font("Amiri", "", str(regular))
        self.pdf.add_font("Amiri", "B", str(bold))
        self.pdf.add_font("Amiri", "I", str(italic))
        self.pdf.add_font("Amiri", "BI", str(bold_italic))
        self.pdf.add_font("Mono", "", str(mono))
        self.pdf.add_font("Mono", "B", str(mono_bold))
        # Code blocks mix Latin and Arabic: DejaVu Sans Mono has no Arabic glyphs,
        # so anything it cannot draw falls back to Amiri.
        self.pdf.set_fallback_fonts(["Amiri", "Mono"])

        self.section_counter = 0
        self.first_heading_done = False

    # ---------------------------------------------------------- primitives ---
    def indent_right(self, extra: float) -> float:
        previous = self.pdf.r_margin
        self.pdf.set_right_margin(MARGIN + extra)
        return previous

    def restore_right(self, previous: float) -> None:
        self.pdf.set_right_margin(previous)

    def space(self, amount: float) -> None:
        self.pdf.ln(amount)

    def ensure(self, height: float) -> None:
        if self.pdf.get_y() + height > PAGE_H - 24:
            self.pdf.add_page()

    # --------------------------------------------------------------- hero ----
    def hero(self, title: str, subtitle: str, note: str, creds: str) -> None:
        pdf = self.pdf
        pdf.add_page()
        top = pdf.get_y()
        height = 46
        pdf.set_fill_color(*BRAND)
        pdf.rect(MARGIN, top, CONTENT_W, height, style="F")
        pdf.set_fill_color(*BRAND_DARK)
        pdf.rect(MARGIN, top + height - 3, CONTENT_W, 3, style="F")

        pdf.set_xy(MARGIN + 6, top + 7)
        pdf.set_font("Amiri", "B", 24)
        pdf.set_text_color(255, 255, 255)
        pdf.multi_cell(CONTENT_W - 12, 11, sanitize(title), align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(MARGIN + 6)
        pdf.set_font("Amiri", "", 12)
        pdf.set_text_color(226, 240, 238)
        pdf.multi_cell(CONTENT_W - 12, 7, sanitize(subtitle), align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(MARGIN + 6)
        pdf.set_font("Amiri", "", 11)
        pdf.set_text_color(203, 231, 226)
        pdf.multi_cell(CONTENT_W - 12, 7, sanitize(note), align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(MARGIN + 6)
        pdf.set_font("Amiri", "B", 11)
        pdf.set_text_color(255, 255, 255)
        pdf.multi_cell(CONTENT_W - 12, 7, sanitize(creds), align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_y(top + height + 8)
        pdf.set_text_color(*INK)

    # ------------------------------------------------------------ headings ---
    def heading(self, level: int, text: str) -> None:
        pdf = self.pdf
        text = plain(text)
        if level == 1:
            pdf.set_font("Amiri", "B", 20)
            pdf.set_text_color(*BRAND)
            self.ensure(20)
            pdf.multi_cell(0, 11, text, align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_text_color(*INK)
            return

        if level == 2:
            pdf.ln(6)
            self.ensure(24)
            y = pdf.get_y()
            pdf.set_font("Amiri", "B", 16)
            pdf.set_text_color(*BRAND)
            pdf.multi_cell(0, 10, text, align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.set_draw_color(*BRAND)
            pdf.set_line_width(0.8)
            pdf.line(MARGIN, pdf.get_y() + 1, PAGE_W - MARGIN, pdf.get_y() + 1)
            pdf.ln(4)
            pdf.set_text_color(*INK)
            self.section_counter += 1
            try:
                pdf.start_section(re.sub(r"[^\w\s\u0600-\u06ff]", "", text).strip())
            except Exception:  # bookmarks are a bonus, never a hard failure
                pass
            return

        if level == 3:
            pdf.ln(4)
            self.ensure(16)
            pdf.set_font("Amiri", "B", 13)
            pdf.set_text_color(*INK)
            pdf.multi_cell(0, 8, text, align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
            return

        pdf.ln(2)
        pdf.set_x(MARGIN)
        pdf.set_font("Amiri", "B", 11)
        pdf.set_text_color(*MUTED)
        pdf.multi_cell(0, 7, text, align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*INK)

    # ----------------------------------------------------------- paragraph ---
    def paragraph(self, text: str) -> None:
        pdf = self.pdf
        pdf.set_font("Amiri", "", 11.5)
        pdf.set_text_color(*INK)
        self.ensure(12)
        pdf.multi_cell(0, 7.4, inline(text), align="R", markdown=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    def bullets(self, items: list[str], ordered: bool) -> None:
        pdf = self.pdf
        previous = self.indent_right(5)
        for index, item in enumerate(items, start=1):
            marker = f"{index}." if ordered else "•"
            pdf.set_font("Amiri", "", 11.5)
            pdf.set_text_color(*INK)
            self.ensure(11)
            pdf.multi_cell(0, 7.2, f"{marker} {inline(item)}", align="R", markdown=True, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
        self.restore_right(previous)
        pdf.ln(2)

    def code_block(self, lines: list[str]) -> None:
        pdf = self.pdf
        text = "\n".join(sanitize(line) for line in lines).rstrip() or " "
        pdf.set_font("Mono", "", 9)
        pdf.set_fill_color(*CODE_BG)
        pdf.set_text_color(*CODE_INK)
        self.ensure(12 + 4 * len(lines))
        pdf.multi_cell(0, 5.4, text, align="L", fill=True, padding=(3, 3, 3, 3), new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*INK)
        pdf.ln(3)

    def quote(self, lines: list[str]) -> None:
        """Highlighted callout: measure with the exact width used to draw."""
        pdf = self.pdf
        text = inline(" ".join(lines))
        pdf.set_font("Amiri", "B", 11)

        bar = 1.6
        pad = 5.0
        box_left = MARGIN + 6
        box_right = PAGE_W - MARGIN - bar
        inner_left = box_left + pad
        width = (box_right - pad) - inner_left

        height = pdf.multi_cell(width, 7, text, align="R", markdown=True, dry_run=True, output="HEIGHT")
        self.ensure(height + 10)
        top = pdf.get_y()

        pdf.set_fill_color(*QUOTE_BG)
        pdf.rect(box_left, top, box_right - box_left, height + 6, style="F")
        pdf.set_fill_color(*QUOTE_BAR)
        pdf.rect(box_right, top, bar, height + 6, style="F")

        pdf.set_text_color(*QUOTE_INK)
        pdf.set_xy(inner_left, top + 3)
        pdf.multi_cell(width, 7, text, align="R", markdown=True, new_x="LMARGIN", new_y="NEXT")

        pdf.set_text_color(*INK)
        pdf.set_y(top + height + 10)
        pdf.set_x(MARGIN)

    # --------------------------------------------------------------- table ---
    def table(self, rows: list[list[str]]) -> None:
        if not rows:
            return
        pdf = self.pdf
        columns = max(len(row) for row in rows)
        rows = [row + [""] * (columns - len(row)) for row in rows]
        header, body = rows[0], rows[1:]
        header = [plain(cell) for cell in header]
        body = [[plain(cell) for cell in cell_row] for cell_row in body]

        # widths: first column gets the space left over, the rest size to content
        pdf.set_font("Amiri", "", 10.5)
        natural = []
        for index in range(columns):
            widest = pdf.get_string_width(header[index]) if index < len(header) else 0
            for row in body:
                widest = max(widest, pdf.get_string_width(row[index]))
            natural.append(min(widest + 7, 96))

        minimum_first = max(38.0, natural[0]) if columns > 1 else CONTENT_W
        others = sum(natural[1:])
        if others + minimum_first <= CONTENT_W:
            widths = [minimum_first] + [natural[i] if natural[i] > 16 else 16 for i in range(1, columns)]
        else:
            total = sum(natural)
            widths = [max(w * CONTENT_W / total, 14) for w in natural]
        scale = CONTENT_W / sum(widths)
        widths = [w * scale for w in widths]

        # right-to-left reading order: the first column is drawn rightmost
        order = list(range(columns))[::-1]

        def draw_row(cells: list[str], bold: bool, fill: tuple[int, int, int] | None) -> None:
            pdf.set_font("Amiri", "B" if bold else "", 10.5)
            heights = []
            for index in order:
                lines = pdf.multi_cell(widths[index] - 4, 6, cells[index] or " ", dry_run=True, output="LINES")
                heights.append(6 * max(1, len(lines)) + 3)
            row_height = max(heights)
            self.ensure(row_height + 2)
            y = pdf.get_y()
            x = MARGIN
            for index in order:
                width = widths[index]
                if fill:
                    pdf.set_fill_color(*fill)
                    pdf.rect(x, y, width, row_height, style="F")
                pdf.set_draw_color(*LINE)
                pdf.set_line_width(0.2)
                pdf.rect(x, y, width, row_height)
                align = "R" if index == (columns - 1) else "C"
                pdf.set_xy(x + 2, y + 1.5)
                pdf.multi_cell(width - 4, 6, cells[index] or " ", align=align)
                x += width
            pdf.set_y(y + row_height)

        draw_row(header, True, TABLE_HEAD)
        for position, row in enumerate(body):
            draw_row(row, False, ZEBRA if position % 2 else None)
        pdf.set_x(MARGIN)
        pdf.ln(3)

    def rule(self) -> None:
        pdf = self.pdf
        pdf.ln(3)
        pdf.set_draw_color(*LINE)
        pdf.set_line_width(0.3)
        pdf.line(MARGIN, pdf.get_y(), PAGE_W - MARGIN, pdf.get_y())
        pdf.ln(4)

    # ---------------------------------------------------------- main entry ---
    def build(self, blocks: list[tuple]) -> None:
        for block in blocks:
            kind = block[0]
            if kind == "h":
                self.heading(block[1], block[2])
            elif kind == "p":
                self.paragraph(block[1])
            elif kind == "ul":
                self.bullets(block[1], ordered=False)
            elif kind == "ol":
                self.bullets(block[1], ordered=True)
            elif kind == "table":
                self.table(block[1])
            elif kind == "quote":
                self.quote(block[1])
            elif kind == "code":
                self.code_block(block[1])
            elif kind == "hr":
                self.rule()


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"Missing source file: {SOURCE}")

    regular, bold, italic, bold_italic, mono, mono_bold = resolve_fonts()
    source = SOURCE.read_text(encoding="utf-8")

    # The leading H1 + intro block becomes the cover banner.
    lines = source.split("\n")
    title = "دليل المبتدئ للمحاسبة ونظام Ledgerly"
    if lines and lines[0].startswith("# "):
        title = lines[0][2:].strip()
        lines = lines[1:]
    rest = "\n".join(lines)

    renderer = Renderer(regular, bold, italic, bold_italic, mono, mono_bold)
    blocks = Blocks(rest).parse()
    renderer.hero(
        title,
        "من الصفر إلى فهم كل عملية محاسبية في النظام — بأمثلة حقيقية من بيانات التطبيق.",
        "كل الأرقام في هذا الدليل مأخوذة من شركة Demo Company Inc. التجريبية.",
        "للدخول إلى التطبيق: admin@demo.local / Admin@12345",
    )
    renderer.build(blocks)
    renderer.pdf.output(str(OUTPUT))
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.0f} KB, {renderer.pdf.pages_count} pages)")


if __name__ == "__main__":
    main()
