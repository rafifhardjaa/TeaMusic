# DATABASE SCHEMA

Target Database: Supabase (PostgreSQL)

## Table: messages

| Column Name   | Data Type | Constraints               | Description |

|---------------|-----------|---------------------------|-------------|

| id            | uuid      | PRIMARY KEY, default gen  | Unique identifier |

| recipient     | text      | NOT NULL                  | Name of the person receiving the message |

| message       | text      | NOT NULL                  | The handwritten message content |

| track\_id      | text      | NOT NULL                  | iTunes Track ID |

| track\_name    | text      | NOT NULL                  | Name of the song |

| artist\_name   | text      | NOT NULL                  | Name of the artist |

| cover\_url     | text      | NOT NULL                  | URL of the album art (from iTunes) |

| preview\_url   | text      | NOT NULL                  | URL of the 30-second audio preview |

| zodiac        | text      | NULLABLE                  | Selected zodiac sign |

| mood          | text      | NULLABLE                  | Selected mood |

| created\_at    | timestamp | DEFAULT now()             | Timestamp of creation |

## Indexes

- `idx_recipient`: Index on `recipient` column for fast search queries.