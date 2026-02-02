from pypdf import PdfReader, PdfWriter

reader = PdfReader(r"C:\Users\svarukal\OneDrive - Microsoft\Attachments\Parent Level_Citi Sanctions Due Diligence Questionnaire.pdf")
# print(reader.get_fields())
writer = PdfWriter()

# THIS preserves the AcroForm
writer.clone_document_from_reader(reader)

writer.update_page_form_field_values(
    writer.pages[0],
    {"Legal Entity Name": "Henrika"}
)

with open("filled.pdf", "wb") as f:
    writer.write(f)

