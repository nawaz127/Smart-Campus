import express from 'express';
import { createServer as createViteServer } from 'vite';
import mongoose from 'mongoose';
import puppeteer from 'puppeteer';
import twilio from 'twilio';
import cors from 'cors';
import { School, User, Student, Attendance, Result } from './src/models/schemas.ts';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// --- Mock SMS Gateway (Twilio) ---
const sendSMS = async (to: string, message: string) => {
  console.log(`[SMS Gateway] Sending to ${to}: ${message}`);
  // In production, use Twilio:
  // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({ body: message, from: '+1234567890', to });
};

// --- Mock Database Store (Fallback) ---
const mockStore: any = {
  schools: [],
  users: [],
  students: [
    { _id: 'S101', studentId: 'S101', name: 'Rahat Ahmed', class: '10-A', attendance: 64, results: [{ subject: 'Math', marks: 85 }, { subject: 'English', marks: 78 }] },
    { _id: 'S102', studentId: 'S102', name: 'Nawaz Sharif', class: '10-B', attendance: 92, results: [{ subject: 'Math', marks: 92 }, { subject: 'English', marks: 88 }] },
  ],
  attendance: [],
  results: [],
};

// --- API Endpoints ---

// 1. Teacher Panel: One-Click Attendance & SMS Trigger
app.post('/api/attendance/mark', async (req, res) => {
  const { schoolId, teacherId, attendanceData } = req.body;
  
  try {
    // Try DB first
    if (mongoose.connection.readyState === 1) {
      const records = await Promise.all(attendanceData.map(async (record: any) => {
        const newRecord = new Attendance({
          schoolId,
          teacherId,
          studentId: record.studentId,
          status: record.status,
          date: new Date(),
        });
        
        if (record.status === 'ABSENT') {
          const student = await Student.findById(record.studentId).populate('parentId');
          if (student && student.parentId && student.parentId.profile.phone) {
            await sendSMS(student.parentId.profile.phone, `Alert: ${student.name} is absent.`);
          }
        }
        return newRecord.save();
      }));
      return res.json({ success: true, count: records.length });
    }

    // Fallback to Mock
    attendanceData.forEach((r: any) => mockStore.attendance.push({ ...r, date: new Date() }));
    res.json({ success: true, count: attendanceData.length, mode: 'mock' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

// 2. Parent Dashboard: Attendance % & PDF Report
app.get('/api/parent/student-report/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    if (mongoose.connection.readyState === 1) {
      const student = await Student.findOne({ studentId }) || await Student.findById(studentId);
      const attendance = await Attendance.find({ studentId: student?._id || studentId });
      const results = await Result.find({ studentId: student?._id || studentId, published: true });

      const totalDays = attendance.length;
      const presentDays = attendance.filter(a => a.status === 'PRESENT').length;
      const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      return res.json({ student, attendancePercentage, results });
    }

    // Fallback to Mock
    const student = mockStore.students.find((s: any) => s.studentId === studentId || s._id === studentId);
    res.json({
      student,
      attendancePercentage: student?.attendance || 85,
      results: student?.results ? [{ subjects: student.results }] : [],
      mode: 'mock'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// 3. Generate Result PDF (Puppeteer)
app.get('/api/reports/generate-pdf/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Mock HTML content for the PDF
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1 style="color: #1e3a8a;">Begum Shahanara Smart Campus</h1>
          <h2>Academic Progress Report</h2>
          <p>Student ID: ${studentId}</p>
          <hr/>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px; border: 1px solid #ddd;">Subject</th>
              <th style="padding: 10px; border: 1px solid #ddd;">Marks</th>
              <th style="padding: 10px; border: 1px solid #ddd;">Grade</th>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Mathematics</td>
              <td style="padding: 10px; border: 1px solid #ddd;">85</td>
              <td style="padding: 10px; border: 1px solid #ddd;">A</td>
            </tr>
          </table>
          <p style="margin-top: 20px;">Generated on: ${new Date().toLocaleDateString()}</p>
        </body>
      </html>
    `;

    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    res.contentType('application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).send('Error generating PDF');
  }
});

// 4. AI Microservice Proxy: Student Performance Prediction
app.get('/api/analytics/predict-risk/:studentId', async (req, res) => {
  const { studentId } = req.params;
  
  // Logic: In a real scenario, this would call the Python/FastAPI microservice
  // const response = await fetch(`http://ai-service:8000/predict/${studentId}`);
  // const prediction = await response.json();
  
  // Mocking the AI response for demonstration
  const prediction = {
    riskLevel: 'MEDIUM',
    confidence: 0.82,
    factors: ['Low attendance in last 2 weeks', 'Declining Math scores'],
    recommendation: 'Schedule parent-teacher meeting',
  };

  res.json(prediction);
});

// --- Database Connection ---
const connectDB = async () => {
  try {
    // In this environment, we'll use a local memory DB if possible, 
    // but for now we'll just try to connect to a default local instance
    // and provide a fallback if it fails.
    await mongoose.connect('mongodb://localhost:27017/smartcampus');
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection failed, using in-memory mock mode.');
  }
};

// --- Seed Data ---
const seedData = async () => {
  try {
    const schoolCount = await School.countDocuments();
    if (schoolCount === 0) {
      const school = await School.create({
        name: 'Begum Shahanara Smart Campus',
        slug: 'bssc',
        branding: { primaryColor: '#2563eb' }
      });

      const parent = await User.create({
        schoolId: school._id,
        firebaseUid: 'parent123',
        email: 'parent@example.com',
        role: 'PARENT',
        profile: { firstName: 'John', lastName: 'Doe', phone: '+1234567890' }
      });

      const teacher = await User.create({
        schoolId: school._id,
        firebaseUid: 'teacher123',
        email: 'teacher@example.com',
        role: 'TEACHER',
        profile: { firstName: 'Sarah', lastName: 'Smith', phone: '+0987654321' }
      });

      const student = await Student.create({
        schoolId: school._id,
        parentId: parent._id,
        studentId: 'S101',
        name: 'Rahat Ahmed',
        class: '10-A',
        rollNumber: 1
      });

      await Attendance.create({
        schoolId: school._id,
        studentId: student._id,
        teacherId: teacher._id,
        status: 'PRESENT'
      });

      await Result.create({
        schoolId: school._id,
        studentId: student._id,
        term: 'Term 1',
        year: '2026',
        subjects: [
          { name: 'Math', marks: 85, grade: 'A' },
          { name: 'English', marks: 78, grade: 'B' }
        ],
        published: true
      });

      console.log('Seed data created successfully.');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
};

// --- Vite Integration ---
async function startServer() {
  await connectDB();
  await seedData();
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Campus Server running on http://localhost:${PORT}`);
  });
}

startServer();
