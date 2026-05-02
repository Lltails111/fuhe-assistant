-- Supabase PostgreSQL Migration
-- Run in: https://supabase.com/dashboard/project/rhkokorpzswrkseiyujg/sql/new

-- 1. user_feedback_links
CREATE TABLE IF NOT EXISTS user_feedback_links (
    id BIGSERIAL PRIMARY KEY,
    link_url VARCHAR(500) NOT NULL,
    university_name VARCHAR(200) NOT NULL,
    target_major VARCHAR(200),
    education_level VARCHAR(20) DEFAULT 'master' CHECK (education_level IN ('bachelor', 'master', 'doctor')),
    submitter_id VARCHAR(100),
    ai_judgment VARCHAR(20) DEFAULT '未知' CHECK (ai_judgment IN ('合理', '部分合理', '不合理', '未知')),
    judgment_reason TEXT,
    user_reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_links_target_major ON user_feedback_links(target_major);
CREATE INDEX IF NOT EXISTS idx_links_education_level ON user_feedback_links(education_level);
CREATE INDEX IF NOT EXISTS idx_links_status ON user_feedback_links(status);

-- 2. link_ratings
CREATE TABLE IF NOT EXISTS link_ratings (
    id BIGSERIAL PRIMARY KEY,
    link_id BIGINT NOT NULL REFERENCES user_feedback_links(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    score SMALLINT CHECK (score BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(link_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_link ON link_ratings(link_id);
CREATE INDEX IF NOT EXISTS idx_ratings_score ON link_ratings(score);

-- 3. knowledge_base
CREATE TABLE IF NOT EXISTS knowledge_base (
    id BIGSERIAL PRIMARY KEY,
    link_id BIGINT UNIQUE NOT NULL REFERENCES user_feedback_links(id) ON DELETE CASCADE,
    university_name VARCHAR(200) NOT NULL,
    link_url VARCHAR(500) NOT NULL,
    target_major VARCHAR(200),
    education_level VARCHAR(20) DEFAULT 'master' CHECK (education_level IN ('bachelor', 'master', 'doctor')),
    avg_score NUMERIC(3,2) DEFAULT 0,
    vote_count INT DEFAULT 0,
    is_trusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_target_major ON knowledge_base(target_major);
CREATE INDEX IF NOT EXISTS idx_kb_education_level ON knowledge_base(education_level);
CREATE INDEX IF NOT EXISTS idx_kb_is_trusted ON knowledge_base(is_trusted);
CREATE INDEX IF NOT EXISTS idx_kb_avg_score ON knowledge_base(avg_score);

-- 4. user_tracks
CREATE TABLE IF NOT EXISTS user_tracks (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    action_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_user ON user_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_action ON user_tracks(action);
CREATE INDEX IF NOT EXISTS idx_tracks_created ON user_tracks(created_at);

-- 5. Updated-at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_links_updated_at ON user_feedback_links;
CREATE TRIGGER trg_links_updated_at
    BEFORE UPDATE ON user_feedback_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_kb_updated_at ON knowledge_base;
CREATE TRIGGER trg_kb_updated_at
    BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Auto-update knowledge_base after rating insert
CREATE OR REPLACE FUNCTION update_kb_after_rating()
RETURNS TRIGGER AS $$
DECLARE
    new_avg NUMERIC(3,2);
    new_count INT;
    feedback_row RECORD;
BEGIN
    SELECT AVG(score)::NUMERIC(3,2), COUNT(*) INTO new_avg, new_count
    FROM link_ratings
    WHERE link_id = NEW.link_id;

    SELECT * INTO feedback_row
    FROM user_feedback_links
    WHERE id = NEW.link_id;

    IF feedback_row.id IS NOT NULL THEN
        INSERT INTO knowledge_base (link_id, university_name, link_url, target_major, education_level, avg_score, vote_count, is_trusted)
        VALUES (
            feedback_row.id,
            feedback_row.university_name,
            feedback_row.link_url,
            feedback_row.target_major,
            feedback_row.education_level,
            new_avg,
            new_count,
            (new_count >= 3 AND new_avg >= 4)
        )
        ON CONFLICT (link_id) DO UPDATE SET
            avg_score = EXCLUDED.avg_score,
            vote_count = EXCLUDED.vote_count,
            is_trusted = EXCLUDED.is_trusted,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rating_update_kb ON link_ratings;
CREATE TRIGGER trg_rating_update_kb
    AFTER INSERT ON link_ratings
    FOR EACH ROW EXECUTE FUNCTION update_kb_after_rating();

-- 7. Trusted sources view
CREATE OR REPLACE VIEW v_trusted_sources AS
SELECT
    kb.id,
    kb.university_name,
    kb.link_url,
    kb.target_major,
    kb.education_level,
    kb.avg_score,
    kb.vote_count,
    f.ai_judgment,
    f.judgment_reason
FROM knowledge_base kb
JOIN user_feedback_links f ON kb.link_id = f.id
WHERE kb.is_trusted = TRUE
ORDER BY kb.avg_score DESC, kb.vote_count DESC;

SELECT 'Migration completed successfully' AS message;
