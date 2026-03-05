from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import random

# This is a demonstration of a Python Data Science backend
# using FastAPI for the Smart Campus AI Analytics module.

app = FastAPI(title="Smart Campus AI Microservice")

class RiskAssessment(BaseModel):
    student_id: str
    risk_level: str
    confidence: float
    factors: List[str]
    recommendation: str

@app.get("/")
def read_root():
    return {"status": "AI Service Online", "framework": "FastAPI", "language": "Python"}

@app.get("/predict/{student_id}", response_model=RiskAssessment)
async def predict_student_risk(student_id: str):
    """
    In a real scenario, this would load a Scikit-learn or TensorFlow model
    to analyze historical attendance and grade data.
    """
    # Mocking Data Science logic for demonstration
    risk_levels = ["LOW", "MEDIUM", "HIGH"]
    factors_pool = [
        "Attendance drop in last 30 days",
        "Decreasing performance in STEM subjects",
        "Low engagement in extracurricular activities",
        "Historical patterns of late arrival",
        "Consistent performance in humanities"
    ]
    
    # Simulate model inference
    risk = random.choice(risk_levels)
    factors = random.sample(factors_pool, 2)
    
    return {
        "student_id": student_id,
        "risk_level": risk,
        "confidence": round(random.uniform(0.75, 0.98), 2),
        "factors": factors,
        "recommendation": "Schedule a review meeting" if risk != "LOW" else "Continue monitoring"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
