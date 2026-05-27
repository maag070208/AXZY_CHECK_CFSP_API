const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

const PRISMA_FILE = path.join(__dirname, "../prisma/schema.prisma");
const SWAGGER_FILE = path.join(__dirname, "../swagger.yaml");
const LLM_REF_FILE = path.join(__dirname, "../react_llm_reference.txt");

function parsePrisma() {
    const content = fs.readFileSync(PRISMA_FILE, 'utf-8');
    const models = {};
    const enums = {};
    
    // 1. Parse Models
    const modelRegex = /model\s+(\w+)\s+\{([^}]+)\}/g;
    let match;
    while ((match = modelRegex.exec(content)) !== null) {
        const modelName = match[1];
        const body = match[2];
        const properties = {};
        const lines = body.trim().split('\n');
        
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('@@') || line.startsWith('//')) {
                continue;
            }
            
            const parts = line.split(/\s+/);
            if (parts.length < 2) continue;
            
            const fieldName = parts[0];
            let fieldType = parts[1];
            
            let isArray = false;
            let isNullable = false;
            let baseType = fieldType;
            
            if (fieldType.endsWith('[]')) {
                isArray = true;
                baseType = fieldType.slice(0, -2);
            } else if (fieldType.endsWith('?')) {
                isNullable = true;
                baseType = fieldType.slice(0, -1);
            }
            
            let propDef = {};
            if (baseType === 'String') {
                propDef = { type: 'string' };
                if (line.includes('@id') || line.toLowerCase().includes('uuid') || fieldName.toLowerCase().includes('id')) {
                    propDef.format = 'uuid';
                }
            } else if (baseType === 'Boolean') {
                propDef = { type: 'boolean' };
            } else if (['Int', 'BigInt'].includes(baseType)) {
                propDef = { type: 'integer' };
            } else if (['Float', 'Decimal'].includes(baseType)) {
                propDef = { type: 'number' };
            } else if (baseType === 'DateTime') {
                propDef = { type: 'string', format: 'date-time' };
            } else if (baseType === 'Json') {
                propDef = { type: 'object' };
            } else {
                // Relation or Enum
                propDef = { $ref: `#/components/schemas/${baseType}` };
            }
            
            if (isArray) {
                propDef = { type: 'array', items: { ...propDef } };
            }
            
            if (isNullable) {
                propDef.nullable = true;
            }
            
            properties[fieldName] = propDef;
        }
        models[modelName] = properties;
    }
    
    // 2. Parse Enums
    const enumRegex = /enum\s+(\w+)\s+\{([^}]+)\}/g;
    while ((match = enumRegex.exec(content)) !== null) {
        const enumName = match[1];
        const body = match[2];
        const values = body.trim().split('\n').map(v => v.trim()).filter(Boolean);
        enums[enumName] = {
            type: 'string',
            enum: values
        };
    }
    
    return { models, enums };
}

function updateSwagger(models, enums) {
    const doc = YAML.load(SWAGGER_FILE);
    
    if (!doc.components) doc.components = {};
    if (!doc.components.schemas) doc.components.schemas = {};
    
    const schemas = doc.components.schemas;
    const FORBIDDEN_FIELDS = ['password', 'hash', 'salt', 'secret', 'token'];
    
    // 1. Inject Enums
    for (const [enumName, enumDef] of Object.entries(enums)) {
        schemas[enumName] = enumDef;
    }
    
    // 2. Inject Prisma Models with Circular Protection
    for (const [modelName, props] of Object.entries(models)) {
        // Version A: BASIC (Only Scalars)
        const basicProps = {};
        for (const [pName, pDef] of Object.entries(props)) {
            if (!pDef.$ref && (!pDef.items || !pDef.items.$ref)) {
                if (!FORBIDDEN_FIELDS.includes(pName)) {
                    basicProps[pName] = pDef;
                }
            }
        }
        
        schemas[`${modelName}Basic`] = {
            type: 'object',
            properties: basicProps
        };
        
        // Version B: DETAILED (Scalars + Basic Relations)
        const detailedProps = {};
        for (const [pName, pDef] of Object.entries(props)) {
            if (FORBIDDEN_FIELDS.includes(pName)) continue;
            
            if (pDef.$ref) {
                const refModel = pDef.$ref.split('/').pop();
                if (models[refModel]) {
                    detailedProps[pName] = { $ref: `#/components/schemas/${refModel}Basic` };
                } else {
                    detailedProps[pName] = pDef;
                }
            } else if (pDef.items && pDef.items.$ref) {
                const refModel = pDef.items.$ref.split('/').pop();
                if (models[refModel]) {
                    detailedProps[pName] = {
                        type: 'array',
                        items: { $ref: `#/components/schemas/${refModel}Basic` }
                    };
                } else {
                    detailedProps[pName] = pDef;
                }
            } else {
                detailedProps[pName] = pDef;
            }
        }
        
        schemas[modelName] = {
            type: 'object',
            properties: detailedProps
        };
        
        // 3. Standard AXZY API Contracts (TResultWrappers)
        schemas[`TResult${modelName}`] = {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                data: { $ref: `#/components/schemas/${modelName}` },
                messages: { type: 'array', items: { type: 'string' } }
            }
        };
        
        schemas[`TResultList${modelName}`] = {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                data: { type: 'array', items: { $ref: `#/components/schemas/${modelName}` } },
                messages: { type: 'array', items: { type: 'string' } }
            }
        };
        
        schemas[`TResultDatatable${modelName}`] = {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                data: {
                    type: 'object',
                    properties: {
                        rows: { type: 'array', items: { $ref: `#/components/schemas/${modelName}` } },
                        total: { type: 'integer', example: 100 },
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 10 }
                    }
                },
                messages: { type: 'array', items: { type: 'string' } }
            }
        };
    }
    
    // Dump safely
    fs.writeFileSync(SWAGGER_FILE, YAML.stringify(doc, 10, 2), 'utf-8');
}

function generateLlmReference() {
    const doc = YAML.load(SWAGGER_FILE);
    const output = [];
    output.push("=== AXZY CHECK API REFERENCE FOR REACT LLM ===");
    output.push("This document contains all API paths, their methods, request bodies, and exact response schemas.");
    output.push("Use this to generate strictly typed API calls, custom hooks, and Zod schemas in the React frontend.\n");
    
    output.push("--- ENDPOINTS ---");
    const paths = doc.paths || {};
    for (const [pathKey, methods] of Object.entries(paths)) {
        for (const [method, details] of Object.entries(methods)) {
            if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                continue;
            }
            
            output.push(`\n${method.toUpperCase()} ${pathKey}`);
            if (details.summary) {
                output.push(`Summary: ${details.summary}`);
            }
            
            if (details.requestBody) {
                try {
                    const schemaRef = details.requestBody.content['application/json'].schema;
                    if (schemaRef.$ref) {
                        const refName = schemaRef.$ref.split('/').pop();
                        output.push(`Request Body Schema: ${refName}`);
                    } else {
                        output.push(`Request Body: ${JSON.stringify(schemaRef)}`);
                    }
                } catch (e) {}
            }
            
            output.push("Responses:");
            if (details.responses) {
                for (const [statusCode, respDetails] of Object.entries(details.responses)) {
                    const desc = respDetails.description || '';
                    try {
                        const schemaRef = respDetails.content['application/json'].schema;
                        if (schemaRef.$ref) {
                            const refName = schemaRef.$ref.split('/').pop();
                            output.push(`  ${statusCode} (${desc}) -> Schema: ${refName}`);
                        } else {
                            output.push(`  ${statusCode} (${desc}) -> Schema: Inline Object`);
                        }
                    } catch (e) {
                        output.push(`  ${statusCode} (${desc}) -> No specific schema`);
                    }
                }
            }
        }
    }
    
    output.push("\n" + "=".repeat(50) + "\n");
    output.push("--- SCHEMAS (MODELS & DTOs) ---");
    const schemas = (doc.components && doc.components.schemas) || {};
    for (const [schemaName, schemaDetails] of Object.entries(schemas)) {
        output.push(`\nSCHEMA: ${schemaName}`);
        output.push(JSON.stringify(schemaDetails, null, 2));
    }
    
    fs.writeFileSync(LLM_REF_FILE, output.join('\n'), 'utf-8');
}

function main() {
    console.log("=== AXZY SWAGGER AUTODOC SYSTEM (JS) ===");
    console.log("[*] Init process...");
    
    console.log("[*] Parsing Prisma schema...");
    const { models, enums } = parsePrisma();
    console.log(`    [+] ${Object.keys(models).length} Models found.`);
    console.log(`    [+] ${Object.keys(enums).length} Enums found.`);
    
    console.log("[*] Updating Swagger YAML...");
    updateSwagger(models, enums);
    console.log(`    [+] ${SWAGGER_FILE} updated.`);
    
    console.log("[*] Generating LLM Text Reference...");
    generateLlmReference();
    console.log(`    [+] ${LLM_REF_FILE} generated.`);
    
    console.log("\n[✔] SYSTEM SYNCED SUCCESSFULLY\n");
}

main();
