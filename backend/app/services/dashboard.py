import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.dashboard import Dashboard, Widget
from app.repositories.dashboard import DashboardRepository, WidgetRepository
from app.schemas.dashboard import DashboardCreate, WidgetCreate

class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DashboardRepository(db)
        self.widget_repo = WidgetRepository(db)

    async def list_dashboards(self, organization_id: uuid.UUID) -> List[Dashboard]:
        return await self.repo.list_by_organization(organization_id)

    async def get_dashboard(self, id: uuid.UUID, organization_id: uuid.UUID) -> Optional[Dashboard]:
        return await self.repo.get_with_widgets(id, organization_id)

    async def create_dashboard(
        self,
        organization_id: uuid.UUID,
        dashboard_in: DashboardCreate,
        user_id: uuid.UUID
    ) -> Dashboard:
        dashboard = Dashboard(
            organization_id=organization_id,
            name=dashboard_in.name,
            description=dashboard_in.description,
            layout=dashboard_in.layout or {},
            is_public=dashboard_in.is_public,
            created_by=user_id
        )
        return await self.repo.create(dashboard)

    async def create_widget(
        self,
        organization_id: uuid.UUID,
        dashboard_id: uuid.UUID,
        widget_in: WidgetCreate
    ) -> Widget:
        # Verify dashboard belongs to organization
        dashboard = await self.repo.get_by_id_scoped(dashboard_id, organization_id)
        if not dashboard:
            raise ValueError("Dashboard not found under this organization")

        widget = Widget(
            dashboard_id=dashboard_id,
            title=widget_in.title,
            type=widget_in.type,
            query_config=widget_in.query_config,
            layout_config=widget_in.layout_config
        )
        return await self.widget_repo.create(widget)

    async def create_from_template(
        self,
        organization_id: uuid.UUID,
        template_name: str, # "Web Analytics" | "Sales Funnel" | "DevOps Monitoring"
        user_id: uuid.UUID
    ) -> Dashboard:
        """Seeds standard SaaS industry dashboards in one click."""
        
        if template_name == "Web Analytics":
            dashboard_in = DashboardCreate(
                name="Web Analytics Dashboard",
                description="Live traffic source distribution, page views, and visitor demographics."
            )
            widgets = [
                WidgetCreate(
                    title="Total Page Views",
                    type="kpi",
                    query_config={"event_name": "page_view", "aggregation": "count", "time_range": "24h"},
                    layout_config={"x": 0, "y": 0, "w": 4, "h": 2}
                ),
                WidgetCreate(
                    title="Unique Visitors Trend",
                    type="line",
                    query_config={"event_name": "page_view", "aggregation": "count", "time_range": "7d"},
                    layout_config={"x": 4, "y": 0, "w": 8, "h": 4}
                ),
                WidgetCreate(
                    title="Traffic Source Breakdown",
                    type="pie",
                    query_config={"event_name": "page_view", "aggregation": "count", "groupby": "referrer", "time_range": "24h"},
                    layout_config={"x": 0, "y": 2, "w": 4, "h": 4}
                )
            ]
        elif template_name == "Sales Funnel":
            dashboard_in = DashboardCreate(
                name="E-Commerce Sales Funnel",
                description="Conversions, cart details, total revenue generated, and live orders."
            )
            widgets = [
                WidgetCreate(
                    title="Total Revenue",
                    type="kpi",
                    query_config={"event_name": "checkout_success", "aggregation": "sum", "field_key": "revenue", "time_range": "30d"},
                    layout_config={"x": 0, "y": 0, "w": 4, "h": 2}
                ),
                WidgetCreate(
                    title="Order Conversion Over Time",
                    type="bar",
                    query_config={"event_name": "checkout_success", "aggregation": "count", "time_range": "30d"},
                    layout_config={"x": 4, "y": 0, "w": 8, "h": 4}
                ),
                WidgetCreate(
                    title="Recent Sales Records",
                    type="table",
                    query_config={"event_name": "checkout_success", "aggregation": "count", "groupby": "item_id", "time_range": "24h"},
                    layout_config={"x": 0, "y": 2, "w": 4, "h": 4}
                )
            ]
        elif template_name == "DevOps Monitoring":
            dashboard_in = DashboardCreate(
                name="DevOps Performance Monitor",
                description="System reliability metrics, latencies, error percentages, and API health."
            )
            widgets = [
                WidgetCreate(
                    title="Error Rate (%)",
                    type="kpi",
                    query_config={"event_name": "api_error", "aggregation": "count", "time_range": "1h"},
                    layout_config={"x": 0, "y": 0, "w": 4, "h": 2}
                ),
                WidgetCreate(
                    title="Average API Latency (ms)",
                    type="line",
                    query_config={"event_name": "api_response", "aggregation": "avg", "field_key": "latency_ms", "time_range": "24h"},
                    layout_config={"x": 4, "y": 0, "w": 8, "h": 4}
                ),
                WidgetCreate(
                    title="Response Codes Distribution",
                    type="bar",
                    query_config={"event_name": "api_response", "aggregation": "count", "groupby": "status_code", "time_range": "24h"},
                    layout_config={"x": 0, "y": 2, "w": 4, "h": 4}
                )
            ]
        else:
            raise ValueError(f"Unknown template: {template_name}")

        # Save Dashboard
        db_dashboard = await self.create_dashboard(organization_id, dashboard_in, user_id)
        
        # Save pre-seeded widgets
        for w in widgets:
            await self.create_widget(organization_id, db_dashboard.id, w)
            
        return db_dashboard
network_connections = []
