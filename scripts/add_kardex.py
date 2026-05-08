import yaml
import re

with open("swagger.yaml", "r", encoding="utf-8") as f:
    yaml_content = f.read()

kardex_schema = """
    Kardex:
      type: object
      properties:
        id: { type: string, format: uuid }
        userId: { type: string, format: uuid }
        locationId: { type: string, format: uuid }
        timestamp: { type: string, format: date-time }
        notes: { type: string, nullable: true }
        media: { type: array, items: { type: string } }
        latitude: { type: number, nullable: true }
        longitude: { type: number, nullable: true }
        assignmentId: { type: string, format: uuid, nullable: true }
        scanType: { type: string }
        createdAt: { type: string, format: date-time }
        user: { $ref: "#/components/schemas/User", nullable: true }
        location: { $ref: "#/components/schemas/Location", nullable: true }

    TResultListKardex:
      type: object
      properties:
        success: { type: boolean, example: true }
        data:
          type: array
          items: { $ref: "#/components/schemas/Kardex" }
        messages: { type: array, items: { type: string } }
"""

if "\n    TResultListKardex:\n" not in yaml_content:
    yaml_content += kardex_schema

# Fix GET /kardex
pattern_kardex = r'(\/kardex:\s*get:[\s\S]*?responses:[\s\S]*?"200":[\s\S]*?schema:\s*\{\s*\$ref:\s*"#/components/schemas/)(TResult)("\s*\})'
# wait, my previous script changed /kardex to TResult.
yaml_content = re.sub(pattern_kardex, rf'\1TResultListKardex\3', yaml_content)

with open("swagger.yaml", "w", encoding="utf-8") as f:
    f.write(yaml_content)
