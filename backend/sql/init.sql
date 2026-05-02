
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;


DROP TRIGGER IF EXISTS update_knowledge_base_after_rating;


DROP VIEW IF EXISTS v_trusted_sources;


DROP TABLE IF EXISTS knowledge_base;
DROP TABLE IF EXISTS link_ratings;
DROP TABLE IF EXISTS user_feedback_links;
DROP TABLE IF EXISTS user_tracks;


CREATE TABLE user_feedback_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    link_url VARCHAR(500) NOT NULL,
    university_name VARCHAR(200) NOT NULL,
    target_major VARCHAR(200),
    education_level ENUM('bachelor', 'master', 'doctor') DEFAULT 'master',
    submitter_id VARCHAR(100),
    ai_judgment ENUM('合理', '部分合理', '不合理', '未知') DEFAULT '未知',
    judgment_reason TEXT,
    user_reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_target_major (target_major),
    INDEX idx_education_level (education_level),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE link_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    link_id INT NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    score TINYINT CHECK (score BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES user_feedback_links(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_link (link_id, user_id),
    INDEX idx_link_id (link_id),
    INDEX idx_score (score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE knowledge_base (
    id INT PRIMARY KEY AUTO_INCREMENT,
    link_id INT UNIQUE,
    university_name VARCHAR(200) NOT NULL,
    link_url VARCHAR(500) NOT NULL,
    target_major VARCHAR(200),
    education_level ENUM('bachelor', 'master', 'doctor') DEFAULT 'master',
    avg_score DECIMAL(3,2) DEFAULT 0,
    vote_count INT DEFAULT 0,
    is_trusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES user_feedback_links(id) ON DELETE CASCADE,
    INDEX idx_target_major (target_major),
    INDEX idx_education_level (education_level),
    INDEX idx_is_trusted (is_trusted),
    INDEX idx_avg_score (avg_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE user_tracks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    action_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DELIMITER //

CREATE TRIGGER update_knowledge_base_after_rating
AFTER INSERT ON link_ratings
FOR EACH ROW
BEGIN
    DECLARE new_avg DECIMAL(3,2);
    DECLARE new_count INT;
    
    SELECT AVG(score), COUNT(*) INTO new_avg, new_count
    FROM link_ratings
    WHERE link_id = NEW.link_id;
    
    INSERT INTO knowledge_base (link_id, university_name, link_url, target_major, education_level, avg_score, vote_count, is_trusted)
    SELECT 
        f.id, 
        f.university_name, 
        f.link_url, 
        f.target_major, 
        f.education_level,
        new_avg,
        new_count,
        (new_count >= 3 AND new_avg >= 4)
    FROM user_feedback_links f
    WHERE f.id = NEW.link_id
    ON DUPLICATE KEY UPDATE
        avg_score = VALUES(avg_score),
        vote_count = VALUES(vote_count),
        is_trusted = VALUES(is_trusted),
        updated_at = CURRENT_TIMESTAMP;
END//

DELIMITER ;


CREATE VIEW v_trusted_sources AS
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


SELECT '数据库初始化完成' AS message;