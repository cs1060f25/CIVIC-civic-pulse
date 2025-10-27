import sys, pathlib, pymupdf, os

pdf_dir = r"backend/processing/test_files"
output_dir = r"backend/processing/output"

# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

for root, dirs, files in os.walk(pdf_dir):
    for file in files:
        with pymupdf.open(os.path.join(root, file)) as doc:  # open document
            text = chr(12).join([page.get_text("text", sort=True) for page in doc])
            text = "\n".join(line.lstrip() for line in text.splitlines())

        # print(text)
        
        # write as a binary file to support non-ASCII characters
        pathlib.Path(os.path.join(output_dir, file.split(".")[0] + ".txt")).write_bytes(text.encode())
