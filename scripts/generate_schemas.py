import os
import re

models = {
    "Client": """    Client:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        address: { type: string, nullable: true }
        rfc: { type: string, nullable: true }
        contactName: { type: string, nullable: true }
        contactPhone: { type: string, nullable: true }
        active: { type: boolean }
        createdAt: { type: string, format: date-time }""",
    "Zone": """    Zone:
      type: object
      properties:
        id: { type: string, format: uuid }
        clientId: { type: string, format: uuid }
        name: { type: string }
        active: { type: boolean }
        client: { $ref: "#/components/schemas/ClientBasic", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Location": """    Location:
      type: object
      properties:
        id: { type: string, format: uuid }
        clientId: { type: string, format: uuid, nullable: true }
        zoneId: { type: string, format: uuid, nullable: true }
        aisle: { type: string, nullable: true }
        spot: { type: string, nullable: true }
        number: { type: string, nullable: true }
        name: { type: string }
        reference: { type: string, nullable: true }
        isOccupied: { type: boolean }
        active: { type: boolean }
        zone: { $ref: "#/components/schemas/Zone", nullable: true }
        client: { $ref: "#/components/schemas/ClientBasic", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Assignment": """    Assignment:
      type: object
      properties:
        id: { type: string, format: uuid }
        guardId: { type: string, format: uuid }
        locationId: { type: string, format: uuid }
        status: { type: string }
        assignedBy: { type: string, format: uuid }
        notes: { type: string, nullable: true }
        guard: { $ref: "#/components/schemas/User", nullable: true }
        location: { $ref: "#/components/schemas/Location", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Round": """    Round:
      type: object
      properties:
        id: { type: string, format: uuid }
        guardId: { type: string, format: uuid }
        clientId: { type: string, format: uuid, nullable: true }
        startTime: { type: string, format: date-time }
        endTime: { type: string, format: date-time, nullable: true }
        status: { type: string }
        recurringConfigurationId: { type: string, format: uuid, nullable: true }
        guard: { $ref: "#/components/schemas/User", nullable: true }
        client: { $ref: "#/components/schemas/ClientBasic", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Incident": """    Incident:
      type: object
      properties:
        id: { type: string, format: uuid }
        guardId: { type: string, format: uuid }
        title: { type: string }
        categoryId: { type: string, format: uuid, nullable: true }
        typeId: { type: string, format: uuid, nullable: true }
        description: { type: string, nullable: true }
        media: { type: array, items: { type: string } }
        latitude: { type: number, nullable: true }
        longitude: { type: number, nullable: true }
        status: { type: string }
        resolvedAt: { type: string, format: date-time, nullable: true }
        resolvedById: { type: string, format: uuid, nullable: true }
        clientId: { type: string, format: uuid, nullable: true }
        guard: { $ref: "#/components/schemas/User", nullable: true }
        client: { $ref: "#/components/schemas/ClientBasic", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Maintenance": """    Maintenance:
      type: object
      properties:
        id: { type: string, format: uuid }
        guardId: { type: string, format: uuid }
        title: { type: string }
        categoryId: { type: string, format: uuid, nullable: true }
        typeId: { type: string, format: uuid, nullable: true }
        description: { type: string, nullable: true }
        media: { type: array, items: { type: string } }
        latitude: { type: number, nullable: true }
        longitude: { type: number, nullable: true }
        status: { type: string }
        resolvedAt: { type: string, format: date-time, nullable: true }
        resolvedById: { type: string, format: uuid, nullable: true }
        clientId: { type: string, format: uuid, nullable: true }
        guard: { $ref: "#/components/schemas/User", nullable: true }
        client: { $ref: "#/components/schemas/ClientBasic", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Schedule": """    Schedule:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        startTime: { type: string }
        endTime: { type: string }
        active: { type: boolean }
        createdAt: { type: string, format: date-time }""",
    "RecurringConfiguration": """    RecurringConfiguration:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        clientId: { type: string, format: uuid, nullable: true }
        active: { type: boolean }
        client: { $ref: "#/components/schemas/ClientBasic", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Category": """    Category:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        value: { type: string }
        type: { type: string }
        color: { type: string, nullable: true }
        icon: { type: string, nullable: true }
        createdAt: { type: string, format: date-time }""",
    "Type": """    Type:
      type: object
      properties:
        id: { type: string, format: uuid }
        categoryId: { type: string, format: uuid }
        name: { type: string }
        value: { type: string }
        category: { $ref: "#/components/schemas/Category", nullable: true }
        createdAt: { type: string, format: date-time }""",
    "SysConfig": """    SysConfig:
      type: object
      properties:
        key: { type: string }
        value: { type: string }
        updatedAt: { type: string, format: date-time }"""
}

with open("swagger.yaml", "r") as f:
    yaml_content = f.read()

additional_schemas = "\n"

for model_name, schema_def in models.items():
    # Only append the model definition if it doesn't already exist
    pattern = rf'\n    {model_name}:\n'
    if not re.search(pattern, yaml_content):
        additional_schemas += schema_def + "\n"
        
    additional_schemas += f"""    TResultDatatable{model_name}:
      type: object
      properties:
        success: {{ type: boolean, example: true }}
        data:
          type: object
          properties:
            rows:
              type: array
              items: {{ $ref: "#/components/schemas/{model_name}" }}
            total: {{ type: integer, example: 55 }}
        messages: {{ type: array, items: {{ type: string }} }}

    TResultList{model_name}:
      type: object
      properties:
        success: {{ type: boolean, example: true }}
        data:
          type: array
          items: {{ $ref: "#/components/schemas/{model_name}" }}
        messages: {{ type: array, items: {{ type: string }} }}
"""

if "\n    TResultDatatableClient:\n" not in yaml_content:
    yaml_content += additional_schemas

endpoint_mappings = {
    "/clients/datatable": "TResultDatatableClient",
    "/clients": "TResultListClient",
    "/zones/datatable": "TResultDatatableZone",
    "/zones": "TResultListZone",
    "/locations/datatable": "TResultDatatableLocation",
    "/locations": "TResultListLocation",
    "/assignments/datatable": "TResultDatatableAssignment",
    "/assignments": "TResultListAssignment",
    "/rounds/datatable": "TResultDatatableRound",
    "/rounds": "TResultListRound",
    "/incidents/datatable": "TResultDatatableIncident",
    "/incidents": "TResultListIncident",
    "/maintenance/datatable": "TResultDatatableMaintenance",
    "/maintenance": "TResultListMaintenance",
    "/schedules/datatable": "TResultDatatableSchedule",
    "/schedules": "TResultListSchedule",
    "/recurring/datatable": "TResultDatatableRecurringConfiguration",
    "/recurring": "TResultListRecurringConfiguration",
    "/settings/categories/datatable": "TResultDatatableCategory",
    "/settings/categories": "TResultListCategory",
    "/settings/types/datatable": "TResultDatatableType",
    "/settings/types": "TResultListType",
    "/settings/sysconfig/datatable": "TResultDatatableSysConfig",
    "/settings/sysconfig": "TResultListSysConfig",
}

for path, ref_name in endpoint_mappings.items():
    is_datatable = "datatable" in path
    
    # Escape slash for regex
    esc_path = path.replace("/", "\\/")
    
    if is_datatable:
        # replace TResultDatatable with specific ref
        pattern = rf'({esc_path}:\s*post:[\s\S]*?responses:[\s\S]*?"200":[\s\S]*?schema:\s*\{{\s*\$ref:\s*"#/components/schemas/)(TResultDatatable)("\s*\}})'
        yaml_content = re.sub(pattern, rf'\1{ref_name}\3', yaml_content)
        # also replace generic TResult if we didn't fix it before
        pattern2 = rf'({esc_path}:\s*post:[\s\S]*?responses:[\s\S]*?"200":[\s\S]*?schema:\s*\{{\s*\$ref:\s*"#/components/schemas/)(TResult)("\s*\}})'
        yaml_content = re.sub(pattern2, rf'\1{ref_name}\3', yaml_content)
    else:
        # GET endpoints currently just have "200": { description: OK }
        pattern_ok = rf'({esc_path}:\s*get:[\s\S]*?responses:\s*)"200":\s*\{{\s*description:\s*OK\s*\}}'
        replacement = f"""\\1"200":
          description: OK
          content:
            application/json:
              schema: {{ $ref: "#/components/schemas/{ref_name}" }}"""
        yaml_content = re.sub(pattern_ok, replacement, yaml_content)

# Handle specific /clients GET which might already use TResult instead of description: OK
pattern_clients = r'(\/clients:\s*get:[\s\S]*?responses:[\s\S]*?"200":[\s\S]*?schema:\s*\{\s*\$ref:\s*"#/components/schemas/)(TResult)("\s*\})'
yaml_content = re.sub(pattern_clients, rf'\1TResultListClient\3', yaml_content)

with open("swagger.yaml", "w") as f:
    f.write(yaml_content)

print("Schemas successfully generated and linked via python script!")
