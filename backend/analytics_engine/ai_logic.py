from dataclasses import dataclass
from statistics import mean


@dataclass
class AIResult:
    risk_level: str
    confidence: float
    factors: list[str]
    recommendation: str
    success_prediction: float


def predict_student_success(grades: list[float], attendance_rate: float, focus_score: float) -> AIResult:
    factors: list[str] = []
    risk_score = 0

    if attendance_rate < 75:
        factors.append("Critical attendance drop detected")
        risk_score += 40
    elif attendance_rate < 85:
        factors.append("Attendance below ideal threshold")
        risk_score += 20

    avg_grade = mean(grades) if grades else 0
    if avg_grade < 60:
        factors.append("Low average academic performance")
        risk_score += 30

    if len(grades) >= 3 and grades[-1] < grades[-2] < grades[-3]:
        factors.append("Last three assessments show decline")
        risk_score += 20

    if focus_score < 70:
        factors.append("Behavioral focus score is below baseline")
        risk_score += 10

    if risk_score >= 60:
        risk_level = "HIGH"
        recommendation = "Student needs a 1-on-1 math review and guardian sync this week."
    elif risk_score >= 30:
        risk_level = "MEDIUM"
        recommendation = "Schedule targeted intervention in weakest subject in next 72 hours."
    else:
        risk_level = "LOW"
        recommendation = "Continue standard monitoring with enrichment tasks."

    success_prediction = max(0, min(100, 100 - risk_score))
    confidence = round(min(0.99, 0.7 + (len(grades) * 0.04)), 2)

    return AIResult(
        risk_level=risk_level,
        confidence=confidence,
        factors=factors,
        recommendation=recommendation,
        success_prediction=success_prediction,
    )
