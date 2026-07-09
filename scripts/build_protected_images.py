from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SITE_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_IMAGES_ROOT = SITE_ROOT / "assets" / "images"
BACKUP_ROOT = SITE_ROOT.parent / f"{SITE_ROOT.name}_private_originals"
CATEGORIES = ("event", "studio", "post")
MAX_LONG_EDGE = 1500
JPEG_QUALITY = 82
WATERMARK_TEXT = "TINGYU / CF"


def find_source_files(category_dir: Path, backup_dir: Path) -> list[Path]:
    if list(category_dir.glob("*-large.jpg")):
        return sorted(category_dir.glob("*-large.jpg"))
    return sorted(backup_dir.glob("*-large.jpg"))


def load_font(image_width: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    size = max(28, image_width // 22)
    font_candidates = [
        Path("C:/Windows/Fonts/georgiab.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/timesbd.ttf"),
    ]
    for candidate in font_candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def resize_for_display(image: Image.Image) -> Image.Image:
    width, height = image.size
    long_edge = max(width, height)
    if long_edge <= MAX_LONG_EDGE:
        return image.copy()

    scale = MAX_LONG_EDGE / long_edge
    resized = (
        max(1, round(width * scale)),
        max(1, round(height * scale)),
    )
    return image.resize(resized, Image.Resampling.LANCZOS)


def apply_watermark(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    overlay = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = load_font(rgba.width)
    small_font = load_font(max(420, rgba.width // 2))

    main_text = WATERMARK_TEXT
    support_text = "PORTFOLIO DISPLAY"
    bbox = draw.textbbox((0, 0), main_text, font=font)
    text_width = bbox[2] - bbox[0]
    y = int(rgba.height * 0.84)
    x_positions = [
        int(rgba.width * 0.08),
        max(int(rgba.width * 0.56), int(rgba.width * 0.08) + text_width + 24),
    ]

    for offset, x in enumerate(x_positions):
      shadow_y = y + offset * 14
      draw.text((x + 2, shadow_y + 2), main_text, fill=(0, 0, 0, 78), font=font)
      draw.text((x, shadow_y), main_text, fill=(245, 240, 232, 92), font=font)

    support_bbox = draw.textbbox((0, 0), support_text, font=small_font)
    support_width = support_bbox[2] - support_bbox[0]
    support_x = rgba.width - support_width - int(rgba.width * 0.05)
    support_y = rgba.height - int(rgba.height * 0.055)
    draw.text((support_x + 1, support_y + 1), support_text, fill=(0, 0, 0, 70), font=small_font)
    draw.text((support_x, support_y), support_text, fill=(245, 240, 232, 74), font=small_font)

    return Image.alpha_composite(rgba, overlay).convert("RGB")


def build_display_image(source_path: Path, destination_path: Path) -> None:
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_path) as source:
        processed = resize_for_display(source)
        watermarked = apply_watermark(processed)
        watermarked.save(
            destination_path,
            format="JPEG",
            quality=JPEG_QUALITY,
            optimize=True,
            progressive=True,
        )


def backup_and_remove_source(source_path: Path, category: str) -> None:
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    backup_dir = BACKUP_ROOT / category
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_target = backup_dir / source_path.name
    if not backup_target.exists():
        shutil.move(str(source_path), str(backup_target))
    else:
        source_path.unlink()


def main() -> None:
    for category in CATEGORIES:
        category_dir = PUBLIC_IMAGES_ROOT / category
        backup_dir = BACKUP_ROOT / category
        for source_path in find_source_files(category_dir, backup_dir):
            display_path = category_dir / source_path.name.replace("-large.jpg", "-display.jpg")
            build_display_image(source_path, display_path)
            if source_path.is_relative_to(PUBLIC_IMAGES_ROOT):
                backup_and_remove_source(source_path, category)
            print(f"processed {source_path.name} -> {display_path.name}")


if __name__ == "__main__":
    main()
