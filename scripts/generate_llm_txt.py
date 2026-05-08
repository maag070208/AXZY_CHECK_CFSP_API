import yaml
import json

def generate_llm_reference():
    with open('swagger.yaml', 'r', encoding='utf-8') as f:
        doc = yaml.safe_load(f)

    output = []
    output.append("=== AXZY CHECK API REFERENCE FOR REACT LLM ===")
    output.append("This document contains all API paths, their methods, request bodies, and exact response schemas.")
    output.append("Use this to generate strictly typed API calls, custom hooks, and Zod schemas in the React frontend.\n")

    # 1. Endpoints
    output.append("--- ENDPOINTS ---")
    paths = doc.get('paths', {})
    for path, methods in paths.items():
        for method, details in methods.items():
            if method.lower() not in ['get', 'post', 'put', 'delete', 'patch']:
                continue
                
            output.append(f"\n{method.upper()} {path}")
            if 'summary' in details:
                output.append(f"Summary: {details['summary']}")
                
            # Request Body
            if 'requestBody' in details:
                try:
                    schema_ref = details['requestBody']['content']['application/json']['schema']
                    if '$ref' in schema_ref:
                        ref_name = schema_ref['$ref'].split('/')[-1]
                        output.append(f"Request Body Schema: {ref_name}")
                    else:
                        output.append(f"Request Body: {json.dumps(schema_ref, indent=2)}")
                except KeyError:
                    pass
            
            # Responses
            output.append("Responses:")
            if 'responses' in details:
                for status_code, resp_details in details['responses'].items():
                    desc = resp_details.get('description', '')
                    try:
                        schema_ref = resp_details['content']['application/json']['schema']
                        if '$ref' in schema_ref:
                            ref_name = schema_ref['$ref'].split('/')[-1]
                            output.append(f"  {status_code} ({desc}) -> Schema: {ref_name}")
                        else:
                            output.append(f"  {status_code} ({desc}) -> Schema: Inline Object")
                    except KeyError:
                        output.append(f"  {status_code} ({desc}) -> No specific schema")
                        
    output.append("\n" + "="*50 + "\n")
    
    # 2. Schemas
    output.append("--- SCHEMAS (MODELS & DTOs) ---")
    schemas = doc.get('components', {}).get('schemas', {})
    for schema_name, schema_details in schemas.items():
        output.append(f"\nSCHEMA: {schema_name}")
        # Simplify the output by just dumping the dictionary nicely
        output.append(json.dumps(schema_details, indent=2))

    with open('react_llm_reference.txt', 'w', encoding='utf-8') as out:
        out.write("\n".join(output))

if __name__ == '__main__':
    generate_llm_reference()
    print("react_llm_reference.txt generated successfully!")
