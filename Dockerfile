# استخدام نسخة Python خفيفة الوزن
FROM python:3.10-slim

# تثبيت أدوات النظام الأساسية
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# إعداد مجلد العمل
WORKDIR /app

# نسخ ملف المتطلبات أولاً (لتسريع بناء الصورة)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ باقي ملفات التطبيق
COPY . .

# تشغيل التطبيق على المنفذ المخصص لـ Hugging Face
CMD ["streamlit", "run", "app.py", "--server.port", "7860", "--server.address", "0.0.0.0"]
