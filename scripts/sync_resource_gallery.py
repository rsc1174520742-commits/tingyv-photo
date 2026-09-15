from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

from build_protected_images import (
    BACKUP_ROOT,
    JPEG_QUALITY,
    apply_watermark,
    resize_for_display,
)

SITE_ROOT = Path(__file__).resolve().parent.parent
RESOURCE_ROOT = SITE_ROOT / "资源"
PUBLIC_IMAGES_ROOT = SITE_ROOT / "assets" / "images"
GALLERY_DATA_PATH = SITE_ROOT / "assets" / "gallery-data.js"

CATEGORY_SOURCES = {
    "event": "场照",
    "studio": "棚拍",
    "post": "后期",
    "outdoor": "外景",
}

TITLE_PREFIXES = {
    "event": "Event",
    "studio": "Studio",
    "post": "Retouch",
    "outdoor": "Outdoor",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def resize_for_thumb(image: Image.Image) -> Image.Image:
    width, height = image.size
    long_edge = max(width, height)
    if long_edge <= 1800:
        return image.copy()
    scale = 1800 / long_edge
    return image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.LANCZOS,
    )


def save_jpeg(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(
        path,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
    )


def build_public_pair(source: Path, category: str, number: int) -> None:
    stem = f"{category}-{number:02d}"
    output_dir = PUBLIC_IMAGES_ROOT / category
    with Image.open(source) as image:
        save_jpeg(resize_for_thumb(image), output_dir / f"{stem}-thumb.jpg", 86)
        save_jpeg(
            apply_watermark(resize_for_display(image)),
            output_dir / f"{stem}-display.jpg",
            JPEG_QUALITY,
        )


def clear_public_category(category: str) -> None:
    category_dir = PUBLIC_IMAGES_ROOT / category
    category_dir.mkdir(parents=True, exist_ok=True)
    for path in category_dir.iterdir():
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            path.unlink()


def source_files(category: str) -> list[Path]:
    source_dir = RESOURCE_ROOT / CATEGORY_SOURCES[category]
    return sorted(
        path
        for path in source_dir.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def js_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def tile_for(category: str, index: int) -> str:
    if category == "studio":
        return (
            "tile-hero",
            "tile-feature",
            "tile-wide",
            "tile-wide",
            "tile-mid",
            "tile-mid",
        )[index % 6]
    return (
        "tile-wide",
        "tile-mid",
        "tile-wide",
        "tile-mid",
        "tile-tall",
        "tile-feature",
    )[index % 6]


def sync_categories() -> None:
    gallery_items: dict[str, list[tuple[str, str, str, int]]] = {}
    for category in CATEGORY_SOURCES:
        clear_public_category(category)
        entries = []
        for number, source in enumerate(source_files(category), start=1):
            build_public_pair(source, category, number)
            stem = f"{category}-{number:02d}"
            entries.append(
                (
                    f"{TITLE_PREFIXES[category]} Frame {number:02d}",
                    f"./assets/images/{category}/{stem}-thumb.jpg",
                    f"./assets/images/{category}/{stem}-display.jpg",
                    number - 1,
                )
            )
            print(f"processed {category}/{source.name} -> {stem}")
        gallery_items[category] = entries

    lines = ["window.galleryData = {"]
    for category, category_items in gallery_items.items():
        lines.append(f"  {category}: [")
        for title, thumb, display, index in category_items:
            lines.append(
                f'    {{ title: "{js_string(title)}", thumb: "{thumb}", '
                f'display: "{display}", tile: "{tile_for(category, index)}" }},'
            )
        lines.append("  ],")
    lines.append("};")
    GALLERY_DATA_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def sync_hero_background() -> None:
    source = RESOURCE_ROOT / "网页背景" / "bcf136637a8399305adfe6fa4ad5ecd4.jpg"
    target = PUBLIC_IMAGES_ROOT / "bg" / "hero.jpg"
    backup = BACKUP_ROOT / "bg" / "hero-previous.jpg"
    backup.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not backup.exists():
        shutil.copy2(target, backup)
    with Image.open(source) as image:
        save_jpeg(resize_for_display(image), target, 88)


def main() -> None:
    sync_categories()
    sync_hero_background()


if __name__ == "__main__":
    main()
