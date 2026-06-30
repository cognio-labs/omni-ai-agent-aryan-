"""
generate_presentation.py — Dynamic PPTX + slides JSON generator for OmniClient.

Public API
----------
create_presentation(topic, template, slide_count, slides_data) -> dict
    Returns: {"file_path": str, "slides_json": list[dict]}

build_slides_from_ai_response(ai_text, topic, slide_count) -> list[dict]
    Parse structured slide JSON from an AI chat response.

TEMPLATE_COLORS — dict of template name -> color constants
"""

from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Optional

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

# Directory where generated .pptx files are stored
PRESENTATIONS_DIR = Path(__file__).parent / "presentations"
PRESENTATIONS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Template colour palettes
# ---------------------------------------------------------------------------

TEMPLATE_COLORS = {
    "Bold Blue": {
        "bg":       RGBColor(37,  99,  235),   # #2563EB
        "accent":   RGBColor(6,   182, 212),   # #06B6D4
        "card":     RGBColor(30,  64,  175),   # #1E40AF
        "text":     RGBColor(255, 255, 255),
        "muted":    RGBColor(224, 231, 255),   # #E0E7FF
    },
    "Graphite Cyan": {
        "bg":       RGBColor(17,  24,  39),    # #111827
        "accent":   RGBColor(34,  211, 238),   # #22D3EE
        "card":     RGBColor(31,  41,  55),    # #1F2937
        "text":     RGBColor(249, 250, 251),
        "muted":    RGBColor(156, 163, 175),
    },
    "Freestyle": {
        "bg":       RGBColor(99,  102, 241),   # #6366F1
        "accent":   RGBColor(167, 139, 250),   # #A78BFA
        "card":     RGBColor(67,  56,  202),   # #4338CA
        "text":     RGBColor(255, 255, 255),
        "muted":    RGBColor(224, 231, 255),
    },
    "Aqua Breeze": {
        "bg":       RGBColor(224, 242, 254),   # #E0F2FE
        "accent":   RGBColor(20,  184, 166),   # #14B8A6
        "card":     RGBColor(240, 249, 255),   # #F0F9FF
        "text":     RGBColor(15,  23,  42),    # #0F172A
        "muted":    RGBColor(100, 116, 139),
    },
    "Emerald Edge": {
        "bg":       RGBColor(255, 255, 255),
        "accent":   RGBColor(16,  185, 129),   # #10B981
        "card":     RGBColor(236, 253, 245),   # #ECFDF5
        "text":     RGBColor(31,  41,  55),    # #1F2937
        "muted":    RGBColor(107, 114, 128),
    },
    "Sandy Rhythm": {
        "bg":       RGBColor(245, 245, 220),   # #F5F5DC beige
        "accent":   RGBColor(139, 69,  19),    # #8B4513 saddlebrown
        "card":     RGBColor(255, 248, 220),   # #FFF8DC cornsilk
        "text":     RGBColor(45,  42,  38),    # #2D2A26
        "muted":    RGBColor(120, 100, 80),
    },
}
DEFAULT_TEMPLATE = "Bold Blue"


def _colors(template: str) -> dict:
    return TEMPLATE_COLORS.get(template, TEMPLATE_COLORS[DEFAULT_TEMPLATE])


# ---------------------------------------------------------------------------
# Slide data helpers
# ---------------------------------------------------------------------------

def _default_slides(topic: str, slide_count: int) -> list[dict]:
    """Generate a generic slide structure when no AI data is provided."""
    title = topic.strip().title()
    slides = [
        {
            "slide_number": 1,
            "type": "title",
            "title": title,
            "subtitle": f"A comprehensive overview of {title}",
            "notes": f"Welcome to this presentation on {title}.",
        },
        {
            "slide_number": 2,
            "type": "agenda",
            "title": "Agenda",
            "points": ["Introduction", "Key Concepts", "Analysis", "Recommendations", "Next Steps"],
            "notes": "Overview of what will be covered in this presentation.",
        },
    ]
    content_templates = [
        {"type": "content", "title": "Key Concepts", "points": [
            f"Core principle 1 of {title}",
            f"Core principle 2 of {title}",
            f"Core principle 3 of {title}",
        ]},
        {"type": "content", "title": "Analysis & Insights", "points": [
            "Data-driven insights",
            "Market trends and patterns",
            "Competitive landscape overview",
        ]},
        {"type": "content", "title": "Strategy", "points": [
            "Short-term priorities",
            "Medium-term goals",
            "Long-term vision",
        ]},
        {"type": "content", "title": "Implementation", "points": [
            "Phase 1: Foundation",
            "Phase 2: Execution",
            "Phase 3: Optimization",
        ]},
        {"type": "content", "title": "Results & KPIs", "points": [
            "Key performance indicators",
            "Success metrics",
            "Tracking and reporting",
        ]},
        {"type": "content", "title": "Case Studies", "points": [
            "Real-world example 1",
            "Real-world example 2",
            "Lessons learned",
        ]},
        {"type": "content", "title": "Challenges & Solutions", "points": [
            "Common pitfalls",
            "Mitigation strategies",
            "Best practices",
        ]},
        {"type": "content", "title": "Tools & Resources", "points": [
            "Essential tools",
            "Recommended resources",
            "Expert guidance",
        ]},
    ]
    for i in range(min(slide_count - 3, len(content_templates))):
        s = content_templates[i].copy()
        s["slide_number"] = i + 3
        s["notes"] = f"Detailed discussion of {s['title'].lower()}."
        slides.append(s)
    slides.append({
        "slide_number": len(slides) + 1,
        "type": "cta",
        "title": "Thank You",
        "subtitle": "Questions & Next Steps",
        "notes": "Open the floor for questions and outline immediate next steps.",
    })
    return slides[:slide_count]


def build_slides_from_ai_response(ai_text: str, topic: str, slide_count: int) -> list[dict]:
    """
    Extract structured slides JSON from an AI response text.
    Looks for a JSON code block first, then falls back to _default_slides.
    """
    # Try ```json ... ``` block
    m = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", ai_text, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            if isinstance(data, list) and data:
                return data[:slide_count]
        except json.JSONDecodeError:
            pass
    # Try raw JSON array
    m2 = re.search(r"(\[\s*\{[\s\S]*?\}\s*\])", ai_text, re.DOTALL)
    if m2:
        try:
            data = json.loads(m2.group(1))
            if isinstance(data, list) and data:
                return data[:slide_count]
        except json.JSONDecodeError:
            pass
    return _default_slides(topic, slide_count)


# ---------------------------------------------------------------------------
# PPTX rendering
# ---------------------------------------------------------------------------

def _apply_bg(slide, colors: dict, prs_width=13.333, prs_height=7.5):
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0), Inches(0),
        Inches(prs_width), Inches(prs_height),
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = colors["bg"]
    bg.line.fill.background()
    # Accent bottom stripe
    acc = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0), Inches(7.2),
        Inches(prs_width), Inches(0.3),
    )
    acc.fill.solid()
    acc.fill.fore_color.rgb = colors["accent"]
    acc.line.fill.background()


def _add_text(slide, left, top, width, height, text, font_size, bold=False, color=None,
              align=PP_ALIGN.LEFT, font_name="Inter", word_wrap=True):
    box = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = box.text_frame
    tf.word_wrap = word_wrap
    p = tf.paragraphs[0]
    p.text = text
    p.font.name = font_name
    p.font.size = Pt(font_size)
    p.font.bold = bold
    if color:
        p.font.color.rgb = color
    p.alignment = align
    return box


def _render_title_slide(slide, data: dict, colors: dict):
    _apply_bg(slide, colors)
    _add_text(slide, 1.0, 1.8, 11.333, 2.0,
              data.get("title", ""), 52, bold=True, color=colors["text"],
              align=PP_ALIGN.CENTER, font_name="Poppins")
    _add_text(slide, 1.5, 4.0, 10.333, 1.5,
              data.get("subtitle", ""), 22, bold=False, color=colors["muted"],
              align=PP_ALIGN.CENTER)


def _render_content_slide(slide, data: dict, colors: dict):
    _apply_bg(slide, colors)
    _add_text(slide, 1.0, 0.6, 11.333, 1.0,
              data.get("title", ""), 34, bold=True, color=colors["text"], font_name="Poppins")
    points = data.get("points") or data.get("bullets") or []
    card = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(1.9),
        Inches(11.333), Inches(4.8),
    )
    card.fill.solid()
    card.fill.fore_color.rgb = colors["card"]
    card.line.color.rgb = colors["accent"]
    card.line.width = Pt(1.5)
    tf = card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.4)
    tf.margin_top = Inches(0.35)
    first = True
    for pt in points:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = "• " + str(pt)
        p.font.name = "Inter"
        p.font.size = Pt(16)
        p.font.color.rgb = colors["text"]
        p.space_before = Pt(10)


def _render_agenda_slide(slide, data: dict, colors: dict):
    _render_content_slide(slide, data, colors)


def _render_cta_slide(slide, data: dict, colors: dict):
    _apply_bg(slide, colors)
    _add_text(slide, 1.0, 2.0, 11.333, 1.8,
              data.get("title", "Thank You"), 52, bold=True, color=colors["text"],
              align=PP_ALIGN.CENTER, font_name="Poppins")
    if data.get("subtitle"):
        _add_text(slide, 1.5, 4.2, 10.333, 1.2,
                  data["subtitle"], 22, color=colors["muted"], align=PP_ALIGN.CENTER)


def _render_slide(prs, slide_data: dict, colors: dict):
    layout = prs.slide_layouts[6]  # blank
    slide = prs.slides.add_slide(layout)
    slide_type = slide_data.get("type", "content").lower()
    if slide_type == "title":
        _render_title_slide(slide, slide_data, colors)
    elif slide_type in ("agenda", "overview"):
        _render_agenda_slide(slide, slide_data, colors)
    elif slide_type in ("cta", "closing", "thank_you", "contact"):
        _render_cta_slide(slide, slide_data, colors)
    else:
        _render_content_slide(slide, slide_data, colors)
    # Speaker notes
    notes = slide_data.get("notes", "")
    if notes:
        slide.notes_slide.notes_text_frame.text = notes


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_presentation(
    topic: str = "Presentation",
    template: str = "Bold Blue",
    slide_count: int = 10,
    slides_data: Optional[list] = None,
) -> dict:
    """
    Generate a .pptx file and return metadata.

    Parameters
    ----------
    topic       : Human-readable topic/title
    template    : Template name from TEMPLATE_COLORS
    slide_count : Number of slides (clamped 8–20)
    slides_data : Optional list of slide dicts from AI; falls back to defaults

    Returns
    -------
    {
        "file_path":   str,       # Relative path under presentations/
        "slides_json": list[dict] # Slide data used
    }
    """
    slide_count = max(8, min(20, slide_count))
    colors = _colors(template)

    if not slides_data:
        slides_data = _default_slides(topic, slide_count)

    # Build PPTX
    prs_obj = Presentation()
    prs_obj.slide_width  = Inches(13.333)
    prs_obj.slide_height = Inches(7.5)

    for sd in slides_data:
        _render_slide(prs_obj, sd, colors)

    # Save to presentations dir
    safe_name = re.sub(r"[^\w\-]", "_", topic.strip().lower())[:40]
    filename   = f"{safe_name}_{uuid.uuid4().hex[:8]}.pptx"
    file_path  = PRESENTATIONS_DIR / filename
    prs_obj.save(str(file_path))

    return {
        "file_path":   str(file_path),
        "slides_json": slides_data,
    }


if __name__ == "__main__":
    result = create_presentation(
        topic="Digital Marketing Strategy for SaaS",
        template="Bold Blue",
        slide_count=10,
    )
    print("Generated:", result["file_path"])
    print("Slides:", len(result["slides_json"]))
