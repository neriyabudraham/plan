# 💰 PlanIt - מערכת ניהול חסכונות והשקעות משפחתיות

מערכת מקיפה לניהול קופות חסכון, מעקב אחר השקעות, והתראות בזמן אמת.

## תכונות עיקריות

- 📊 **דשבורד מתקדם** - סקירה כללית של כל החסכונות, גרפים והתקדמות
- 💰 **ניהול קופות** - יצירת קופות מותאמות אישית עם יעדים ותאריכי יעד
- 📈 **מעקב תנועות** - הפקדות, משיכות, וריביות עם היסטוריה מלאה
- 🔄 **הפקדות חוזרות** - הגדרת הפקדות אוטומטיות בתדירות קבועה
- 👥 **ניהול משתמשים** - הרשאות מדורגות (מנהל, עורך, צופה)
- 📱 **התראות WhatsApp** - עדכונים בזמן אמת על פעילות בקופות
- 🔐 **אימות מאובטח** - התחברות עם מייל/סיסמה או Google OAuth

## טכנולוגיות

### Backend
- Node.js + Express + TypeScript
- PostgreSQL
- JWT Authentication
- Nodemailer (Gmail SMTP)

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Recharts
- Zustand

### Infrastructure
- Docker + Docker Compose
- Nginx (reverse proxy)

## התקנה מקומית

### דרישות מוקדמות
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (או שימוש ב-Docker)

### שלבים

1. **שכפל את הפרויקט**
```bash
git clone https://github.com/neriyabudraham/plan.git
cd plan
```

2. **צור קובץ `.env`**
```bash
cp .env.example .env
# ערוך את הערכים בהתאם
```

3. **הרץ עם Docker**
```bash
docker-compose up -d
```

4. **או הרץ מקומית (ללא Docker)**
```bash
# Backend
cd backend
npm install
npm run db:init  # יצירת טבלאות + משתמש מנהל
npm run dev

# Frontend (בטרמינל נפרד)
cd frontend
npm install
npm run dev
```

5. **גש לאפליקציה**
- Frontend: http://localhost:5173 (dev) או http://localhost:3955 (production)
- API: http://localhost:3955/api

## משתמש מנהל ראשוני

לאחר אתחול מסד הנתונים, נוצר משתמש מנהל:
- **מייל**: office@neriyabudraham.co.il (או מה שהגדרת ב-ADMIN_EMAIL)
- **סיסמה**: admin123

⚠️ **חשוב**: החלף את הסיסמה בכניסה הראשונה!

## API Endpoints

### אימות
- `POST /api/auth/login` - התחברות
- `POST /api/auth/google` - התחברות עם Google
- `POST /api/auth/refresh` - רענון טוקן
- `POST /api/auth/forgot-password` - שכחתי סיסמה
- `POST /api/auth/reset-password` - איפוס סיסמה

### קופות
- `GET /api/funds` - רשימת קופות
- `POST /api/funds` - יצירת קופה
- `GET /api/funds/:id` - פרטי קופה
- `PATCH /api/funds/:id` - עדכון קופה
- `DELETE /api/funds/:id` - מחיקת קופה

### תנועות
- `GET /api/transactions` - רשימת תנועות
- `POST /api/transactions` - יצירת תנועה
- `DELETE /api/transactions/:id` - מחיקת תנועה

### הפקדות חוזרות
- `GET /api/recurring` - רשימת הפקדות חוזרות
- `POST /api/recurring` - יצירת הפקדה חוזרת
- `PATCH /api/recurring/:id` - עדכון
- `DELETE /api/recurring/:id` - מחיקה

### משתמשים (מנהל בלבד)
- `GET /api/users` - רשימת משתמשים
- `POST /api/users` - יצירת משתמש
- `POST /api/users/invite` - שליחת הזמנה
- `PATCH /api/users/:id` - עדכון משתמש
- `DELETE /api/users/:id` - מחיקת משתמש

### WhatsApp (מנהל בלבד)
- `GET /api/whatsapp/settings` - הגדרות
- `POST /api/whatsapp/settings` - שמירת הגדרות
- `GET /api/whatsapp/groups` - רשימת קבוצות
- `POST /api/whatsapp/test` - בדיקת התראה

## פריסה לייצור

1. **העלה לשרת**
```bash
scp -r plan/ user@server:/www/wwwroot/plan.botomat.co.il/
```

2. **הרץ Docker**
```bash
cd /www/wwwroot/plan.botomat.co.il
docker-compose up -d --build
```

3. **הגדר Nginx**
```nginx
server {
    listen 80;
    server_name plan.botomat.co.il;
    
    location / {
        proxy_pass http://localhost:3955;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## רישיון

MIT License
