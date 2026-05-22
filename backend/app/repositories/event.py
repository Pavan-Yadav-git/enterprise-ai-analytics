import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, cast, Float, text, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.event import Event
from app.repositories.base import BaseRepository

class EventRepository(BaseRepository[Event]):
    def __init__(self, db: AsyncSession):
        super().__init__(Event, db)

    async def bulk_insert(self, events: List[Event]) -> None:
        """Efficient bulk insertion of events."""
        self.db.add_all(events)
        await self.db.flush()

    async def list_recent(self, organization_id: uuid.UUID, limit: int = 50) -> List[Event]:
        """Tails the most recent events for live screen stream."""
        result = await self.db.execute(
            select(Event)
            .filter(Event.organization_id == organization_id)
            .order_by(Event.timestamp.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_aggregation(
        self,
        organization_id: uuid.UUID,
        event_name: str,
        aggregation_type: str, # "count", "sum", "avg"
        field_key: Optional[str], # inside payload, e.g. "revenue" or "duration"
        groupby_key: Optional[str], # inside payload, e.g. "browser" or "status"
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        Mixpanel/Metabase style dynamic aggregator.
        Aggregates events over a time window with optional groupings.
        """
        filters = [
            Event.organization_id == organization_id,
            Event.event_name == event_name,
            Event.timestamp >= start_time,
            Event.timestamp <= end_time
        ]

        # Determine value to aggregate
        if aggregation_type == "count":
            aggregate_func = func.count(Event.id)
        elif aggregation_type == "sum" and field_key:
            # Cast payload->field_key as Float
            aggregate_func = func.sum(cast(Event.payload[field_key].as_string(), Float))
        elif aggregation_type == "avg" and field_key:
            aggregate_func = func.avg(cast(Event.payload[field_key].as_string(), Float))
        else:
            aggregate_func = func.count(Event.id)

        # Assemble grouping
        group_by_cols = []
        select_cols = [aggregate_func.label("value")]

        if groupby_key:
            # Group by custom JSONB payload property
            json_col = Event.payload[groupby_key].as_string().label("group")
            select_cols.append(json_col)
            group_by_cols.append(json_col)
        else:
            # Group by date-trunc to create line charts
            # postgres date_trunc
            trunc_col = func.date_trunc('hour', Event.timestamp).label("group")
            select_cols.append(trunc_col)
            group_by_cols.append(trunc_col)

        query = (
            select(*select_cols)
            .filter(and_(*filters))
            .group_by(*group_by_cols)
            .order_by("group")
        )

        result = await self.db.execute(query)
        rows = result.all()

        output = []
        for r in rows:
            group_val = r[1]
            if isinstance(group_val, datetime):
                group_val = group_val.isoformat()
            
            # Clean JSON strings if postgres returns double quotes
            if isinstance(group_val, str) and group_val.startswith('"') and group_val.endswith('"'):
                group_val = group_val[1:-1]
                
            output.append({
                "label": group_val or "unknown",
                "value": float(r[0]) if r[0] is not None else 0.0
            })

        return output

    async def get_overview_stats(self, organization_id: uuid.UUID, hours: int = 24) -> Dict[str, Any]:
        """Provides dynamic overview KPIs for main page dashboard."""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        # 1. Total events count
        total_q = await self.db.execute(
            select(func.count(Event.id))
            .filter(Event.organization_id == organization_id, Event.timestamp >= since)
        )
        total_events = total_q.scalar() or 0
        
        # 2. Count by source type
        source_q = await self.db.execute(
            select(Event.source_type, func.count(Event.id))
            .filter(Event.organization_id == organization_id, Event.timestamp >= since)
            .group_by(Event.source_type)
        )
        sources = {row[0]: row[1] for row in source_q.all()}
        
        # 3. Dynamic distribution of event names
        names_q = await self.db.execute(
            select(Event.event_name, func.count(Event.id))
            .filter(Event.organization_id == organization_id, Event.timestamp >= since)
            .group_by(Event.event_name)
            .order_by(desc(func.count(Event.id)))
            .limit(5)
        )
        event_distribution = [{"name": row[0], "count": row[1]} for row in names_q.all()]

        return {
            "total_events": total_events,
            "sources": sources,
            "distribution": event_distribution,
            "time_window_hours": hours
        }
