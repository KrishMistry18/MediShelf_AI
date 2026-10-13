import io
from pathlib import Path
from typing import Union, Tuple
from PIL import Image
import torch
from torchvision import transforms

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def validate_image(image_input: Union[bytes, Image.Image, Path, str]) -> Image.Image:
    """
    Validates input image data, ensures valid dimensions and converts to standard RGB.
    Raises ValueError on corruption or insufficient resolution.
    """
    if isinstance(image_input, (bytes, bytearray)):
        try:
            im = Image.open(io.BytesIO(image_input))
            im.verify()
            im = Image.open(io.BytesIO(image_input))
        except Exception as e:
            raise ValueError(f"Corrupted or unsupported image bytes: {e}")
    elif isinstance(image_input, (str, Path)):
        path = Path(image_input)
        if not path.exists():
            raise FileNotFoundError(f"Image path not found: {path}")
        try:
            im = Image.open(path)
            im.verify()
            im = Image.open(path)
        except Exception as e:
            raise ValueError(f"Corrupted image file: {e}")
    elif isinstance(image_input, Image.Image):
        im = image_input
    else:
        raise TypeError(f"Unsupported image input type: {type(image_input)}")

    if im.width < 32 or im.height < 32:
        raise ValueError(f"Image resolution too small: {im.width}x{im.height}. Minimum required is 32x32.")

    # Convert to standard RGB (handles PNG transparency, palette, and grayscale)
    if im.mode != "RGB":
        im = im.convert("RGB")

    return im


def get_train_transforms(image_size: int = 224) -> transforms.Compose:
    """
    Returns realistic, packaging-safe augmentation transforms:
    - Direct dimension resize (preserves outer edge packaging text and dosage badges)
    - Strictly avoids horizontal flipping (text/logos must never be mirrored)
    - Conservative rotation (-7 to 7 degrees)
    - Moderate lighting and contrast jitter (indoor ambient/fluorescent variations)
    - Standard ImageNet normalization
    """
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomRotation(degrees=(-7, 7)),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.10),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_eval_transforms(image_size: int = 224) -> transforms.Compose:
    """
    Deterministic evaluation and inference transform:
    - Direct dimension resize (preserves entire packaging without border cropping)
    - Tensor normalization
    """
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def preprocess_for_inference(
    image_input: Union[bytes, Image.Image, Path, str],
    image_size: int = 224,
) -> torch.Tensor:
    """
    Full inference preprocessor taking raw image input and returning a batch tensor [1, 3, H, W].
    """
    valid_img = validate_image(image_input)
    transform = get_eval_transforms(image_size)
    tensor = transform(valid_img)
    return tensor.unsqueeze(0)  # Add batch dimension [1, 3, 224, 224]
