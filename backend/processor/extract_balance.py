import sys
import json
import re
from pathlib import Path
from PyPDF2 import PdfReader

def load_config(config_path):
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def clean_number(text):
    text = text.replace('.', '').replace(',', '.')
    if re.match(r"^\(\d+\.\d+\)$", text.strip()):
        return '-' + text.strip()[1:-1]
    return text.strip()

def extract_data(text, config):
    results = {}
    for key, spec in config['keywords'].items():
        mode = spec['mode']
        variants = spec.get('variants', [key])  # Usa 'key' si no hay variants
        found = False
        for variant in variants:
            if mode == 'two_numbers_after':
                match = re.search(
                    re.escape(variant) + r'[^0-9\-]+([\(]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})[\)]?)\D+([\(]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})[\)]?)',
                    text
                )
                if match:
                    results[key] = [clean_number(match.group(1)), clean_number(match.group(2))]
                    found = True
                    break
            elif mode == 'until_dot':
                match = re.search(re.escape(variant) + r'(.+?)\.', text)
                if match:
                    results[key] = match.group(1).strip()
                    found = True
                    break
            elif mode == 'until_newline':
                match = re.search(re.escape(variant) + r'([^\n\r]+)', text)
                if match:
                    results[key] = match.group(1).strip()
                    found = True
                    break
            elif mode == 'between_phrases':
                start = spec.get('start_phrase', variant)
                end = spec.get('end_phrase', '')
                match = re.search(re.escape(start) + r'(.*?)' + re.escape(end), text, re.DOTALL)
                if match:
                    results[key] = match.group(1).strip()
                    found = True
                    break
        # Si no encontró nada, pon vacío o lista vacía según el modo
        if not found:
            if mode == 'two_numbers_after':
                results[key] = ["", ""]
            else:
                results[key] = ""
    return results

def main():
    if len(sys.argv) < 4:
        print(json.dumps({'error': 'Faltan argumentos: pdf_path config_path output_path'}))
        return

    file_path = sys.argv[1]
    config_path = sys.argv[2]
    output_path = sys.argv[3]
    try:
        reader = PdfReader(file_path)
        full_text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
        config = load_config(config_path)
        extracted = extract_data(full_text, config)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(extracted, f, ensure_ascii=False)
    except Exception as e:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({'error': str(e)}, f, ensure_ascii=False)

if __name__ == '__main__':
    main()
