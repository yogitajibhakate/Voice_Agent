import asyncio
import os
import sys

# Add project root to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.db import db_client

async def main():
    async with db_client.async_session() as session:
        from sqlalchemy.future import select
        from api.db.models import OrganizationModel, TelephonyConfigurationModel, TelephonyPhoneNumberModel
        
        orgs = (await session.execute(select(OrganizationModel))).scalars().all()
        print("=== ORGANIZATIONS ===")
        for org in orgs:
            print(f"ID: {org.id} | Provider ID: {org.provider_id}")
            
        configs = (await session.execute(select(TelephonyConfigurationModel))).scalars().all()
        print("\n=== TELEPHONY CONFIGURATIONS ===")
        for cfg in configs:
            print(f"ID: {cfg.id} | Org ID: {cfg.organization_id} | Name: {cfg.name} | Provider: {cfg.provider} | Credentials: {cfg.credentials}")
            
        from api.db.models import WorkflowModel
        workflows = (await session.execute(select(WorkflowModel))).scalars().all()
        print("\n=== WORKFLOWS ===")
        for wf in workflows:
            print(f"ID: {wf.id} | Org ID: {wf.organization_id} | Name: {wf.name} | Mode: {wf.mode if hasattr(wf, 'mode') else 'N/A'}")
            
        nums = (await session.execute(select(TelephonyPhoneNumberModel))).scalars().all()
        print("\n=== TELEPHONY PHONE NUMBERS ===")
        for num in nums:
            print(f"ID: {num.id} | Config ID: {num.telephony_configuration_id} | Address: {num.address} | Address Normalized: {num.address_normalized} | Active: {num.is_active} | Inbound Workflow ID: {num.inbound_workflow_id}")

if __name__ == "__main__":
    asyncio.run(main())
