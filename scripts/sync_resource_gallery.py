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

SOURCE_GROUPS = {
    "event": [
        "尼尔.jpg",
        "DSC_3164.png",
        "DSC_35810.png",
        "DSC_3839.png",
        "DSC_39891.png",
        "DSC_4033.png",
    ],
    "post": [
        "2c5368ea5d0c382be52b2113c0636218.jpg",
        "bb5208bf06c4592c5cc157806b453af9.jpg",
        "d0c9d8d92cff1c9188d802e70ddf23c4.jpg",
        "d85ca768556ff7947c9e18f848ee5127.jpg",
        "e2a0c18bc54d8c94dd14fa0f586e77c5.jpg",
    ],
    "outdoor": [
        "_RSC2881.jpg",
        "04b90049a956e42a65e81e9c0426bfbe.jpg",
        "2597f4c8dddb6482d1eba443d7166418.jpg",
        "3d8bfa5c63a626135a970e9e0ba6f37d.jpg",
        "4b910699df3fe040c8e963f30857fcb9.png",
        "6722c38818f139ee5129dd6fc1754d54.jpg",
        "96058898b81e8dbcd6c62c54e6b24206.png",
        "dee20660218d6de7d797e4f9292f2b0a.jpg",
        "DSC_4206.png",
        "DSC_4216111.jpg",
        "DSC_42471.png",
        "DSC_4597.jpg",
        "fe3ff72879d2f4d93edfa8b4563907af.jpg",
        "Gemini_Generated_Image_yg4ty3yg4ty3yg4t.jpg",
    ],
}

START_NUMBERS = {
    "event": 19,
    "post": 9,
    "outdoor": 1,
}


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
        path, format="JPEG", quality=quality, optimize=True, progressive=True
    )


def build_public_pair(source: Path, category: str, number: int) -> None:
    stem = f"{category}-{number:02d}"
    output_dir = PUBLIC_IMAGES_ROOT / category
    with Image.open(source) as image:
        thumb = resize_for_thumb(image)
        display = apply_watermark(resize_for_display(image))
        save_jpeg(thumb, output_dir / f"{stem}-thumb.jpg", 86)
        save_jpeg(display, output_dir / f"{stem}-display.jpg", 82)


def sync_group(category: str, names: list[str]) -> None:
    source_dir = RESOURCE_ROOT / {"event": "场照", "post": "后期", "outdoor": "外景"}[category]
    for offset, name in enumerate(names, start=1):
        source = source_dir / name
        if not source.exists():
            raise FileNotFoundError(source)
        build_public_pair(source, category, START_NUMBERS[category] + offset - 1)
        print(f"processed {category}/{name}")


def sync_hero_background() -> None:
    source = RESOURCE_ROOT / "网页背景" / "bcf136637a8399305adfe6fa4ad5ecd4.jpg"
    target = PUBLIC_IMAGES_ROOT / "bg" / "hero.jpg"
    backup = BACKUP_ROOT / "bg" / "hero-previous.jpg"
    backup.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not backup.exists():
        shutil.copy2(target, backup)
    with Image.open(source) as image:
        save_jpeg(resize_for_display(image), target, 88)
    print("updated bg/hero.jpg")


def main() -> None:
    for category, names in SOURCE_GROUPS.items():
        sync_group(category, names)
    sync_hero_background()


if __name__ == "__main__":
    main()
