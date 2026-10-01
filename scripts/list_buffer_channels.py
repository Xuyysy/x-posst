"""Read and display the connected Buffer channels for one API key."""
import json
import os
import sys
import requests

ENDPOINT = "https://api.buffer.com"
TIMEOUT = (5, 15)
ORGANIZATIONS_QUERY = """query GetOrganizations {
  account { organizations { id name } }
}"""
CHANNELS_QUERY = """query GetChannels {
  channels(input: { organizationId: ORGANIZATION_ID }) { id name service }
}"""


def main() -> int:
    api_key = os.environ.get("BUFFER_API_KEY")
    if not api_key:
        print("Missing required environment variable: BUFFER_API_KEY", file=sys.stderr)
        return 1
    session = requests.Session()
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        org_response = session.post(ENDPOINT, headers=headers, json={"query": ORGANIZATIONS_QUERY}, timeout=TIMEOUT)
        if org_response.status_code != 200:
            print(f"Buffer organization query failed (HTTP {org_response.status_code})", file=sys.stderr)
            return 1
        org_body = org_response.json()
        if org_body.get("errors"):
            print("Buffer organization query returned a GraphQL error", file=sys.stderr)
            return 1
        organizations = org_body.get("data", {}).get("account", {}).get("organizations", [])
        if not organizations:
            print("No Buffer organizations found.")
        for organization in organizations:
            org_id = organization.get("id")
            response = session.post(ENDPOINT, headers=headers,
                                    json={"query": CHANNELS_QUERY.replace("ORGANIZATION_ID", json.dumps(org_id))}, timeout=TIMEOUT)
            if response.status_code != 200:
                print(f"Channel query failed for an organization (HTTP {response.status_code})", file=sys.stderr)
                return 1
            channel_body = response.json()
            if channel_body.get("errors"):
                print("Buffer channel query returned a GraphQL error", file=sys.stderr)
                return 1
            channels = channel_body.get("data", {}).get("channels", [])
            for channel in channels:
                print(f"Organization: {organization.get('name')} | Channel: {channel.get('name')} | "
                      f"Service: {channel.get('service')} | ID: {channel.get('id')}")
    except (requests.exceptions.RequestException, ValueError, AttributeError) as exc:
        print(f"Buffer channel lookup failed ({type(exc).__name__})", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
