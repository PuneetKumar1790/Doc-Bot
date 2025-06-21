# extract_text.py
import sys
import fitz  # PyMuPDF

def extract_text(pdf_path):
    text = ""
    try:
        with fitz.open(pdf_path) as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        print("ERROR:", e)
        sys.exit(1)
    print(text)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("No file path provided")
        sys.exit(1)

    extract_text(sys.argv[1])
