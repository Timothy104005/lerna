from pathlib import Path
from PIL import Image, ImageChops

BG_HEX = "#faf9f6"


def hex_to_rgba(hex_color: str) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


def make_background(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), hex_to_rgba(BG_HEX))


def remove_flat_background(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    bg_rgb = image.getpixel((0, 0))[:3]
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if (
                abs(r - bg_rgb[0]) <= 6
                and abs(g - bg_rgb[1]) <= 6
                and abs(b - bg_rgb[2]) <= 6
            ):
                pixels[x, y] = (r, g, b, 0)
            else:
                pixels[x, y] = (r, g, b, a)
    bbox = image.getbbox()
    return image.crop(bbox) if bbox else image


def compose_square_icon(logo: Image.Image, output_size: int, scale: float) -> Image.Image:
    canvas = make_background(output_size)
    logo_max = max(logo.width, logo.height)
    target_size = max(1, int(output_size * scale))
    ratio = target_size / logo_max
    resized = logo.resize(
        (max(1, int(logo.width * ratio)), max(1, int(logo.height * ratio))),
        Image.Resampling.LANCZOS,
    )
    left = (output_size - resized.width) // 2
    top = (output_size - resized.height) // 2
    canvas.paste(resized, (left, top), resized)
    return canvas


def main() -> None:
    project_dir = Path(__file__).resolve().parent.parent
    repo_dir = project_dir.parent
    source_icon_path = repo_dir / "assets" / "lerna-icon-512.png"
    if not source_icon_path.exists():
      raise FileNotFoundError(f"Missing source icon: {source_icon_path}")

    logo = remove_flat_background(Image.open(source_icon_path))

    resources_dir = project_dir / "resources"
    icons_dir = project_dir / "www" / "icons"
    resources_dir.mkdir(parents=True, exist_ok=True)
    icons_dir.mkdir(parents=True, exist_ok=True)

    icon_1024 = compose_square_icon(logo, 1024, 0.82)
    icon_1024.save(resources_dir / "icon.png")

    splash = compose_square_icon(logo, 2732, 0.34)
    splash.save(resources_dir / "splash.png")

    compose_square_icon(logo, 192, 0.82).save(icons_dir / "icon-192.png")
    compose_square_icon(logo, 512, 0.82).save(icons_dir / "icon-512.png")
    compose_square_icon(logo, 512, 0.68).save(icons_dir / "icon-maskable-512.png")
    compose_square_icon(logo, 180, 0.82).save(icons_dir / "apple-touch-icon-180.png")

    favicon = compose_square_icon(logo, 64, 0.82)
    favicon.save(icons_dir / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    print("Generated resources and PWA icons.")


if __name__ == "__main__":
    main()
