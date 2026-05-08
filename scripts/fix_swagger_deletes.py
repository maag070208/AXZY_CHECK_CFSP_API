import re

with open("swagger.yaml", "r", encoding="utf-8") as f:
    yaml_content = f.read()

# For DELETE endpoints returning "200": { description: OK }
# Replace with standard TResult and errors.
delete_replacement = """        "200":
          description: OK
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResult" }
        "400":
          description: Petición inválida o restricción de llave foránea
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }
        "404":
          description: No encontrado
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }
        "500":
          description: Error interno del servidor
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }"""

# Find all 'delete:' blocks that just have a simple responses block with OK
pattern_delete = r'(delete:[\s\S]*?responses:\s*)"200":\s*\{\s*description:\s*OK\s*\}'
yaml_content = re.sub(pattern_delete, rf'\1{delete_replacement}', yaml_content)

# For PUT /status or /toggle returning "200": { description: OK }
put_replacement = """        "200":
          description: OK
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResult" }
        "400":
          description: Petición inválida
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }
        "404":
          description: No encontrado
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }
        "500":
          description: Error interno del servidor
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }"""

# Simple PUT responses
pattern_put = r'(put:[\s\S]*?responses:\s*)"200":\s*\{\s*description:\s*OK\s*\}'
yaml_content = re.sub(pattern_put, rf'\1{put_replacement}', yaml_content)

# Generic POST endpoints like sysconfig or sync push that still have simple OK
pattern_post = r'(post:[\s\S]*?responses:\s*)"200":\s*\{\s*description:\s*OK\s*\}'
yaml_content = re.sub(pattern_post, rf'\1{put_replacement}', yaml_content)

# And GET endpoints (like /kardex, reports, sync, catalog)
# They will just return TResultList[Model] if we can infer, otherwise TResult
get_replacement = """        "200":
          description: OK
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResult" }
        "400":
          description: Petición inválida
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }
        "500":
          description: Error interno del servidor
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TResultError" }"""
pattern_get = r'(get:[\s\S]*?responses:\s*)"200":\s*\{\s*description:\s*OK\s*\}'
yaml_content = re.sub(pattern_get, rf'\1{get_replacement}', yaml_content)

with open("swagger.yaml", "w", encoding="utf-8") as f:
    f.write(yaml_content)

print("Swagger base responses migrated.")
