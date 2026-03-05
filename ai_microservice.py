from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
# import joblib # For loading pre-trained models

app = FastAPI(title="Smart Campus AI Microservice")

class PredictionRequest(BaseModel):
    student_id: str
    historical_grades: List[float]
    attendance_rate: float
    behavioral_score: Optional[float] = 0.5

class PredictionResponse(BaseModel):
    student_id: str
    risk_level: str  # LOW, MEDIUM, HIGH
    confidence: float
    at_risk_factors: List[str]
    suggested_intervention: str

@app.post("/predict", response_model=PredictionResponse)
async def predict_student_risk(request: PredictionRequest):
    """
    Predicts if a student is at risk of academic failure based on:
    1. Historical Grade Trends (Regression analysis)
    2. Attendance Frequency (Correlation with performance)
    3. Behavioral Data
    """
    
    # Logic: Simple heuristic for demonstration
    # In production, this would use a Random Forest or Gradient Boosting model
    
    risk_factors = []
    risk_score = 0
    
    # 1. Attendance Check
    if request.attendance_rate < 0.75:
        risk_factors.append("Critical: Attendance below 75%")
        risk_score += 40
    elif request.attendance_rate < 0.85:
        risk_factors.append("Warning: Attendance below 85%")
        risk_score += 20
        
    # 2. Grade Trend Check
    if len(request.historical_grades) >= 2:
        trend = request.historical_grades[-1] - request.historical_grades[-2]
        if trend < -0.5:
            risk_factors.append("Negative grade trend detected")
            risk_score += 30
            
    # 3. Absolute Grade Check
    avg_grade = sum(request.historical_grades) / len(request.historical_grades) if request.historical_grades else 0
    if avg_grade < 2.0: # Assuming 4.0 scale
        risk_factors.append("Low average GPA")
        risk_score += 30

    # Determine Risk Level
    if risk_score >= 60:
        risk_level = "HIGH"
        intervention = "Immediate counselor intervention required."
    elif risk_score >= 30:
        risk_level = "MEDIUM"
        intervention = "Schedule parent-teacher meeting."
    else:
        risk_level = "LOW"
        intervention = "Continue regular monitoring."

    return PredictionResponse(
        student_id=request.student_id,
        risk_level=risk_level,
        confidence=0.85, # Mock confidence
        at_risk_factors=risk_factors,
        suggested_intervention=intervention
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
