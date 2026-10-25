import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms
from PIL import Image
import random, numpy as np, time
from sklearn.metrics import accuracy_score, f1_score

def set_seed(seed=101):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

set_seed(101)

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

train_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomRotation(degrees=(-7, 7)),
    transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.10),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])

val_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])

train_ds = datasets.ImageFolder("ml/datasets/train", transform=train_tf)
val_ds = datasets.ImageFolder("ml/datasets/val", transform=val_tf)

train_loader = DataLoader(train_ds, batch_size=8, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=8, shuffle=False)

device = torch.device("cpu")
model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
in_features = model.classifier[0].in_features
model.classifier = nn.Sequential(
    nn.Linear(in_features, 256),
    nn.Hardswish(),
    nn.Dropout(p=0.2),
    nn.Linear(256, 10),
)
model.to(device)

criterion = nn.CrossEntropyLoss(label_smoothing=0.05)

# Warmup 5 epochs
for p in model.features.parameters(): p.requires_grad = False
optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=5e-4, weight_decay=1e-2)
for ep in range(5):
    model.train()
    for x, y in train_loader:
        optimizer.zero_grad()
        loss = criterion(model(x), y)
        loss.backward()
        optimizer.step()

# Fine-tune 40 epochs
for p in model.features[7:].parameters(): p.requires_grad = True
param_groups = [
    {"params": model.features[7:].parameters(), "lr": 7e-5},
    {"params": model.classifier.parameters(), "lr": 4e-4},
]
optimizer = torch.optim.AdamW(param_groups, weight_decay=1e-2)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=40, eta_min=1e-6)

best_val = 0.0
for ep in range(1, 41):
    model.train()
    for x, y in train_loader:
        optimizer.zero_grad()
        loss = criterion(model(x), y)
        loss.backward()
        optimizer.step()
    scheduler.step()
    
    if ep % 5 == 0 or ep > 25:
        model.eval()
        y_true, y_pred = [], []
        top3_hits = 0
        with torch.no_grad():
            for x, y in val_loader:
                out = model(x)
                probs = torch.softmax(out, dim=1)
                _, preds = torch.max(probs, 1)
                _, top3 = torch.topk(probs, k=3, dim=1)
                for i in range(y.size(0)):
                    if y[i] in top3[i]: top3_hits += 1
                y_true.extend(y.numpy())
                y_pred.extend(preds.numpy())
        acc = accuracy_score(y_true, y_pred)
        top3_acc = top3_hits / len(y_true)
        if acc > best_val: best_val = acc
        print(f"Epoch {ep:2d}: Val Top-1 = {acc*100:.2f}% ({sum(1 for a, b in zip(y_true, y_pred) if a==b)}/{len(y_true)}) | Top-3 = {top3_acc*100:.2f}% | Best = {best_val*100:.2f}%")
