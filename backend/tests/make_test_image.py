"""Generates a screenshot-like product image (JPEG) for /api/scan-product tests."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "product_screenshot.jpg")


def build():
    W, H = 480, 800
    img = Image.new("RGB", (W, H), (250, 250, 252))
    d = ImageDraw.Draw(img)

    # top bar (dark) - simulates TikTok Shop header
    d.rectangle([0, 0, W, 56], fill=(18, 18, 20))
    d.text((16, 20), "TikTok Shop", fill=(255, 255, 255))
    d.text((380, 20), "Keranjang", fill=(230, 230, 230))

    # product photo area with real visual features (shapes, gradients, edges)
    for y in range(70, 400):
        shade = int(200 - (y - 70) * 0.25)
        d.line([(20, y), (W - 20, y)], fill=(shade, shade - 20, 240 - int((y - 70) * 0.2)))
    d.ellipse([120, 120, 360, 360], fill=(240, 120, 90), outline=(60, 30, 30), width=4)
    d.rectangle([180, 170, 300, 320], fill=(255, 245, 230), outline=(90, 60, 40), width=3)
    d.text((200, 230), "SERUM", fill=(30, 30, 30))
    d.polygon([(200, 400), (240, 340), (280, 400)], fill=(60, 140, 90))

    # badge
    d.rectangle([24, 74, 190, 100], fill=(220, 40, 60))
    d.text((32, 82), "Top selling #1", fill=(255, 255, 255))

    # price + title block
    d.text((20, 420), "Rp54.450", fill=(220, 20, 60))
    d.text((20, 450), "Serum Vitamin C Brightening 20ml", fill=(20, 20, 20))
    d.text((20, 476), "Skincare Original BPOM", fill=(90, 90, 90))
    d.text((20, 506), "Varian: Hitam, Size L", fill=(50, 50, 50))
    d.text((20, 536), "Earn Rp5.445", fill=(0, 120, 60))
    d.text((20, 566), "Terjual 12,3RB  |  Rating 4.9", fill=(110, 110, 110))

    # separators and button (edges/texture)
    d.line([(0, 600), (W, 600)], fill=(210, 210, 214), width=2)
    d.rectangle([20, 620, 220, 668], fill=(255, 220, 60), outline=(180, 150, 20), width=2)
    d.text((60, 638), "Tambah Keranjang", fill=(30, 30, 30))
    d.rectangle([250, 620, 460, 668], fill=(230, 30, 60))
    d.text((300, 638), "Beli Sekarang", fill=(255, 255, 255))
    for i in range(12):
        d.line([(20, 700 + i * 6), (W - 20, 700 + i * 6)], fill=(225 - i * 4, 225, 230))

    img.save(OUT, "JPEG", quality=88)
    return OUT


if __name__ == "__main__":
    print(build())
