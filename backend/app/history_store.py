from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


class HistoryStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                '''
                CREATE TABLE IF NOT EXISTS prediction_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    location_name TEXT NOT NULL,
                    input_payload TEXT NOT NULL,
                    recommendation_payload TEXT NOT NULL
                )
                '''
            )
            conn.commit()

    def add(self, location_name: str, input_payload: dict[str, Any], recommendation_payload: dict[str, Any]) -> None:
        with self._connect() as conn:
            conn.execute(
                '''
                INSERT INTO prediction_history (timestamp, location_name, input_payload, recommendation_payload)
                VALUES (?, ?, ?, ?)
                ''',
                (
                    datetime.utcnow().isoformat(),
                    location_name,
                    json.dumps(input_payload),
                    json.dumps(recommendation_payload),
                ),
            )
            conn.commit()

    def list(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._connect() as conn:
            cursor = conn.execute(
                '''
                SELECT id, timestamp, location_name, input_payload, recommendation_payload
                FROM prediction_history
                ORDER BY id DESC
                LIMIT ?
                ''',
                (limit,),
            )
            rows = cursor.fetchall()

        return [
            {
                'id': row[0],
                'timestamp': row[1],
                'location_name': row[2],
                'input_payload': json.loads(row[3]),
                'recommendation_payload': json.loads(row[4]),
            }
            for row in rows
        ]