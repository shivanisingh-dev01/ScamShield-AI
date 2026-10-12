import json
import math
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "scam_model.json"


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def predict_scam(text):
    if not text or not text.strip():
        raise ValueError("Message cannot be empty.")

    with open(MODEL_PATH, "r", encoding="utf-8") as file:
        model = json.load(file)

    words = tokenize(text)

    vocabulary = set(model["vocabulary"])
    vocabulary_size = len(vocabulary)

    scores = {}

    for label in (0, 1):
        key = str(label)

        document_count = model["documents"][key]
        total_documents = model["total_documents"]
        total_words = model["total_words"][key]
        word_counts = model["word_counts"][key]

        score = math.log(document_count / total_documents)

        for word in words:
            if word not in vocabulary:
                continue

            count = word_counts.get(word, 0)

            probability = (count + 1) / (
                total_words + vocabulary_size
            )

            score += math.log(probability)

        scores[label] = score

    max_score = max(scores.values())

    exp_scores = {
        label: math.exp(score - max_score)
        for label, score in scores.items()
    }

    total = sum(exp_scores.values())

    scam_probability = exp_scores[1] / total

    return {
        "prediction": (
            "Scam" if scam_probability >= 0.5 else "Legitimate"
        ),
        "scam_probability": round(scam_probability, 4),
        "model": "Multinomial Naive Bayes",
    }


if __name__ == "__main__":
    examples = [
        "Your bank account has been suspended. Verify immediately.",
        "Hi, are we meeting tomorrow for lunch?",
    ]

    for example in examples:
        print(predict_scam(example))