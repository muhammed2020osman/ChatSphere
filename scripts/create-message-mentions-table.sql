-- Create message_mentions table if it doesn't exist
CREATE TABLE IF NOT EXISTS message_mentions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  company_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_message_mentions_message (message_id),
  INDEX idx_message_mentions_user (user_id),
  INDEX idx_message_mentions_company (company_id)
);

