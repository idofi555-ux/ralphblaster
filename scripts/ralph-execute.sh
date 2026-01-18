#!/bin/bash

# Ralph Execution Script
# Usage: ./ralph-execute.sh <INSTANCE_DIR> <PROJECT_PATH>

set -e

INSTANCE_DIR="$1"
PROJECT_PATH="$2"

if [ -z "$INSTANCE_DIR" ] || [ -z "$PROJECT_PATH" ]; then
    echo "Usage: $0 <INSTANCE_DIR> <PROJECT_PATH>"
    exit 1
fi

PRD_FILE="$INSTANCE_DIR/source-prd.md"
PROGRESS_FILE="$INSTANCE_DIR/progress.md"
PROGRESS_JSON="$INSTANCE_DIR/progress.json"

# Log function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$PROGRESS_FILE"
    echo "[$timestamp] $1"
}

update_status() {
    local status="$1"
    local phase="$2"
    local message="$3"
    cat > "$PROGRESS_JSON" << EOF
{
  "status": "$status",
  "phase": "$phase",
  "message": "$message",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "logs": []
}
EOF
}

# Verify PRD exists
if [ ! -f "$PRD_FILE" ]; then
    log "ERROR: PRD file not found at $PRD_FILE"
    update_status "FAILED" "Error" "PRD file not found"
    exit 1
fi

log "Starting Ralph execution"
log "Instance: $INSTANCE_DIR"
log "Project: $PROJECT_PATH"

update_status "LAUNCHING" "Setup" "Setting up Ralph environment..."

# Change to project directory
cd "$PROJECT_PATH" || {
    log "ERROR: Failed to change to project directory"
    update_status "FAILED" "Error" "Failed to access project directory"
    exit 1
}

# Try to create worktree for isolated development
BRANCH_NAME="ralph/$(basename "$INSTANCE_DIR")"
WORKTREE_PATH="$INSTANCE_DIR/worktree"

if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    log "Creating git worktree: $BRANCH_NAME"
    if git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" 2>/dev/null; then
        log "Worktree created successfully"
        WORK_DIR="$WORKTREE_PATH"
    else
        log "Note: Could not create worktree, working directly in project"
        WORK_DIR="$PROJECT_PATH"
    fi
else
    log "Note: Not a git repository, working directly in project"
    WORK_DIR="$PROJECT_PATH"
fi

update_status "RUNNING" "Execution" "Claude is implementing the PRD..."
log "Working directory: $WORK_DIR"
log "Invoking Claude Code..."

# Execute Claude with the PRD
cd "$WORK_DIR"

claude --dangerously-skip-permissions --print "
You are Ralph, an autonomous coding agent. Your task is to implement the PRD.

PRD Location: $PRD_FILE
Working Directory: $WORK_DIR
Progress Log: $PROGRESS_FILE

Instructions:
1. Read the PRD file carefully
2. Implement each requirement step by step
3. Write tests for each feature when appropriate
4. Commit after each completed task with a descriptive message
5. Append progress updates to the progress log file

IMPORTANT:
- Work incrementally, completing one task at a time
- Test your changes before moving to the next task
- If you encounter errors, debug and fix them
- Be thorough but efficient

Begin implementation now.
" 2>&1 | while IFS= read -r line; do
    log "$line"
done

EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -eq 0 ]; then
    log "Ralph execution completed successfully"
    update_status "COMPLETED" "Done" "Implementation completed successfully!"
else
    log "Ralph execution failed with code $EXIT_CODE"
    update_status "FAILED" "Error" "Ralph exited with code $EXIT_CODE"
fi

exit $EXIT_CODE
