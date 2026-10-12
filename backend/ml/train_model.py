import csv
import json
import math
import re
from collections import Counter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "training_data.csv"
MODEL_PATH = BASE_DIR / "scam_model.json"


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def train_model():
    documents = {0: 0, 1: 0}
    word_counts = {0: Counter(), 1: Counter()}
    total_words = {0: 0, 1: 0}
    vocabulary = set()

    with open(DATA_PATH, "r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            label = int(row["label"])
            if label not in (0, 1):
                raise ValueError("Labels must be 0 or 1.")

            words = tokenize(row["text"])

            documents[label] += 1
            word_counts[label].update(words)
            total_words[label] += len(words)
            vocabulary.update(words)

    total_documents = sum(documents.values())

    if total_documents == 0 or not all(documents.values()):
        raise ValueError(
            "Training data must contain both scam and legitimate messages."
        )

    model = {
        "documents": documents,
        "word_counts": {
            str(label): dict(word_counts[label])
            for label in (0, 1)
        },
        "total_words": total_words,
        "vocabulary": sorted(vocabulary),
        "total_documents": total_documents,
    }

    with open(MODEL_PATH, "w", encoding="utf-8") as file:
        json.dump(model, file, indent=2)

    print("Model training completed!")
    print(f"Model saved to: {MODEL_PATH}")


if __name__ == "__main__":
    train_model()