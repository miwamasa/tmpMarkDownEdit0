class StructuredMarkdownEditor {
    constructor() {
        this.blocks = [];
        this.variables = new Map();
        this.groups = new Map();
        this.groupCounter = 0;
        this.draggedBlock = null;
        this.draggedGroup = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFromStorage();
        this.updatePreview();
    }

    bindEvents() {
        const blockButtons = document.querySelectorAll('.block-btn');
        blockButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.addBlock(btn.dataset.type);
            });
        });

        document.getElementById('add-variable-btn').addEventListener('click', () => {
            this.addVariable();
        });

        document.getElementById('group-selected-btn').addEventListener('click', () => {
            this.groupSelectedBlocks();
        });

        document.querySelector('.copy-btn').addEventListener('click', () => {
            this.copyToClipboard();
        });

        document.querySelector('.download-btn').addEventListener('click', () => {
            this.downloadMarkdown();
        });

        document.querySelector('.upload-btn').addEventListener('click', () => {
            this.uploadFile();
        });
    }

    addBlock(type, groupId = null) {
        const blockId = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const block = {
            id: blockId,
            type: type,
            content: this.getDefaultContent(type),
            groupId: groupId,
            selected: false,
            order: this.blocks.length
        };

        this.blocks.push(block);
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    getDefaultContent(type) {
        const defaults = {
            heading: '# New Heading',
            paragraph: 'New paragraph content...',
            list: '- Item 1\n- Item 2\n- Item 3',
            code: '```javascript\n// Your code here\nconsole.log("Hello World");\n```',
            table: {
                headers: ['Column 1', 'Column 2', 'Column 3'],
                rows: [
                    ['Cell 1', 'Cell 2', 'Cell 3'],
                    ['Cell 4', 'Cell 5', 'Cell 6']
                ]
            }
        };
        return defaults[type] || '';
    }

    renderAllContent() {
        const container = document.getElementById('blocks-container');
        container.innerHTML = '';
        
        // Create a unified ordered list combining blocks and groups
        const orderedItems = [];
        
        // Add ungrouped blocks
        this.blocks.filter(block => !block.groupId).forEach(block => {
            orderedItems.push({
                type: 'block',
                item: block,
                order: block.order || 0
            });
        });
        
        // Add groups
        this.groups.forEach((group, groupId) => {
            const groupBlocks = this.blocks.filter(block => block.groupId === groupId);
            if (groupBlocks.length > 0) {
                orderedItems.push({
                    type: 'group',
                    item: group,
                    blocks: groupBlocks,
                    order: group.order || 0
                });
            }
        });
        
        // Sort by order
        orderedItems.sort((a, b) => a.order - b.order);
        
        // Render in order
        orderedItems.forEach(item => {
            if (item.type === 'block') {
                this.renderBlock(item.item, container);
            } else if (item.type === 'group') {
                this.renderGroup(item.item, item.blocks, container);
            }
        });

        this.bindBlockEvents();
    }

    renderBlock(block, container) {
        const blockElement = document.createElement('div');
        blockElement.className = `block ${block.selected ? 'selected' : ''}`;
        blockElement.dataset.blockId = block.id;
        blockElement.draggable = true;

        blockElement.innerHTML = `
            <div class="block-header">
                <input type="checkbox" class="block-select" data-block-id="${block.id}" ${block.selected ? 'checked' : ''}>
                <span class="drag-handle">⋮⋮</span>
                <span>${this.getBlockTypeLabel(block.type)}</span>
                <div class="block-controls">
                    <button onclick="editor.moveBlockUp('${block.id}')">↑</button>
                    <button onclick="editor.moveBlockDown('${block.id}')">↓</button>
                    <button onclick="editor.deleteBlock('${block.id}')" style="color: #dc3545;">🗑️</button>
                </div>
            </div>
            <div class="block-content">
                ${this.renderBlockContent(block)}
            </div>
        `;

        this.addDragEvents(blockElement);
        container.appendChild(blockElement);
    }

    renderGroup(group, blocks, container) {
        const groupElement = document.createElement('div');
        groupElement.className = 'group';
        groupElement.dataset.groupId = group.id;
        groupElement.draggable = true;

        groupElement.innerHTML = `
            <div class="group-header">
                <span class="drag-handle">⋮⋮</span>
                <input type="text" class="group-name-input" value="${group.name}" data-group-id="${group.id}">
                <div class="group-controls">
                    <button onclick="editor.moveGroupUp('${group.id}')">↑</button>
                    <button onclick="editor.moveGroupDown('${group.id}')">↓</button>
                    <button onclick="editor.ungroupBlocks('${group.id}')">📤 Ungroup</button>
                    <button onclick="editor.deleteGroup('${group.id}')" style="color: #dc3545;">🗑️</button>
                </div>
            </div>
            <div class="group-content">
                ${blocks.map(block => this.renderGroupBlock(block)).join('')}
            </div>
        `;

        this.addGroupDragEvents(groupElement);
        container.appendChild(groupElement);
    }

    renderGroupBlock(block) {
        return `
            <div class="block group-block ${block.selected ? 'selected' : ''}" data-block-id="${block.id}" draggable="true">
                <div class="block-header">
                    <input type="checkbox" class="block-select" data-block-id="${block.id}" ${block.selected ? 'checked' : ''}>
                    <span class="drag-handle">⋮⋮</span>
                    <span>${this.getBlockTypeLabel(block.type)}</span>
                    <div class="block-controls">
                        <button onclick="editor.deleteBlock('${block.id}')" style="color: #dc3545;">🗑️</button>
                    </div>
                </div>
                <div class="block-content">
                    ${this.renderBlockContent(block)}
                </div>
            </div>
        `;
    }

    renderBlockContent(block) {
        if (block.type === 'table') {
            return this.renderTableEditor(block);
        } else {
            return `<textarea class="block-input" data-block-id="${block.id}" placeholder="Enter your ${block.type} content...">${block.content}</textarea>`;
        }
    }

    renderTableEditor(block) {
        const table = block.content;
        let html = '<div class="table-container">';
        html += '<table class="editable-table">';
        
        html += '<thead><tr>';
        html += '<th class="delete-col-header"></th>';
        table.headers.forEach((header, index) => {
            html += `<th><input type="text" class="table-input header-input" data-block-id="${block.id}" data-row="-1" data-col="${index}" value="${header}"></th>`;
            html += `<th class="delete-col-cell"><button class="delete-col-btn" onclick="editor.deleteTableColumn('${block.id}', ${index})">🗑️</button></th>`;
        });
        html += '</tr></thead>';
        
        html += '<tbody>';
        table.rows.forEach((row, rowIndex) => {
            html += '<tr>';
            html += `<td class="delete-row-cell"><button class="delete-row-btn" onclick="editor.deleteTableRow('${block.id}', ${rowIndex})">🗑️</button></td>`;
            row.forEach((cell, colIndex) => {
                html += `<td><input type="text" class="table-input" data-block-id="${block.id}" data-row="${rowIndex}" data-col="${colIndex}" value="${cell}"></td>`;
                html += '<td></td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        
        html += `
            <div class="table-controls">
                <button class="table-control-btn" onclick="editor.addTableRow('${block.id}')">Add Row</button>
                <button class="table-control-btn" onclick="editor.addTableColumn('${block.id}')">Add Column</button>
            </div>
        `;
        html += '</div>';
        
        return html;
    }

    getBlockTypeLabel(type) {
        const labels = {
            heading: '📝 Heading',
            paragraph: '📄 Paragraph',
            list: '📋 List',
            table: '📊 Table',
            code: '💻 Code'
        };
        return labels[type] || type;
    }

    addDragEvents(element) {
        element.addEventListener('dragstart', (e) => {
            this.draggedBlock = element;
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            this.draggedBlock = null;
            document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
        });

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.showDropZones(element);
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleDrop(element);
        });
    }

    addGroupDragEvents(element) {
        element.addEventListener('dragstart', (e) => {
            this.draggedGroup = element;
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            this.draggedGroup = null;
            document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
        });

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.showGroupDropZones(element);
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleGroupDrop(element);
        });
    }

    showDropZones(targetElement) {
        document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
        
        if (this.draggedBlock && this.draggedBlock !== targetElement) {
            const dropZone = document.createElement('div');
            dropZone.className = 'drop-zone active';
            targetElement.parentNode.insertBefore(dropZone, targetElement);
        }
    }

    showGroupDropZones(targetElement) {
        document.querySelectorAll('.drop-zone').forEach(zone => zone.remove());
        
        if (this.draggedGroup && this.draggedGroup !== targetElement) {
            const dropZone = document.createElement('div');
            dropZone.className = 'drop-zone active';
            targetElement.parentNode.insertBefore(dropZone, targetElement);
        }
    }

    handleGroupDrop(targetElement) {
        if (this.draggedGroup && this.draggedGroup !== targetElement) {
            const draggedGroupId = this.draggedGroup.dataset.groupId;
            const targetGroupId = targetElement.dataset.groupId;
            
            if (draggedGroupId && targetGroupId) {
                const groupsArray = Array.from(this.groups.entries());
                const draggedIndex = groupsArray.findIndex(([id]) => id === draggedGroupId);
                const targetIndex = groupsArray.findIndex(([id]) => id === targetGroupId);
                
                if (draggedIndex !== -1 && targetIndex !== -1) {
                    const draggedGroup = groupsArray.splice(draggedIndex, 1)[0];
                    groupsArray.splice(targetIndex, 0, draggedGroup);
                    this.groups = new Map(groupsArray);
                    
                    this.renderAllContent();
                    this.updatePreview();
                    this.saveToStorage();
                }
            }
        }
    }

    handleDrop(targetElement) {
        if (this.draggedBlock && this.draggedBlock !== targetElement) {
            const draggedId = this.draggedBlock.dataset.blockId;
            const targetId = targetElement.dataset.blockId;
            
            const draggedIndex = this.blocks.findIndex(b => b.id === draggedId);
            const targetIndex = this.blocks.findIndex(b => b.id === targetId);
            
            if (draggedIndex !== -1 && targetIndex !== -1) {
                const draggedBlock = this.blocks.splice(draggedIndex, 1)[0];
                this.blocks.splice(targetIndex, 0, draggedBlock);
                
                this.rerenderAllBlocks();
                this.updatePreview();
                this.saveToStorage();
            }
        }
    }

    moveBlockUp(blockId) {
        const block = this.blocks.find(b => b.id === blockId);
        if (!block) return;

        if (block.groupId) {
            // Moving within a group
            const groupBlocks = this.blocks.filter(b => b.groupId === block.groupId);
            groupBlocks.sort((a, b) => (a.order || 0) - (b.order || 0));
            const index = groupBlocks.findIndex(b => b.id === blockId);
            
            if (index > 0) {
                const temp = groupBlocks[index].order;
                groupBlocks[index].order = groupBlocks[index - 1].order;
                groupBlocks[index - 1].order = temp;
            }
        } else {
            // Moving ungrouped block - need to consider all items (blocks and groups)
            this.moveItemUp('block', blockId);
        }
        
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    moveBlockDown(blockId) {
        const block = this.blocks.find(b => b.id === blockId);
        if (!block) return;

        if (block.groupId) {
            // Moving within a group
            const groupBlocks = this.blocks.filter(b => b.groupId === block.groupId);
            groupBlocks.sort((a, b) => (a.order || 0) - (b.order || 0));
            const index = groupBlocks.findIndex(b => b.id === blockId);
            
            if (index < groupBlocks.length - 1) {
                const temp = groupBlocks[index].order;
                groupBlocks[index].order = groupBlocks[index + 1].order;
                groupBlocks[index + 1].order = temp;
            }
        } else {
            // Moving ungrouped block - need to consider all items (blocks and groups)
            this.moveItemDown('block', blockId);
        }
        
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    moveItemUp(itemType, itemId) {
        const allItems = this.getAllOrderedItems();
        const index = allItems.findIndex(item => 
            item.type === itemType && 
            (itemType === 'block' ? item.item.id === itemId : item.item.id === itemId)
        );
        
        if (index > 0) {
            const temp = allItems[index].order;
            allItems[index].order = allItems[index - 1].order;
            allItems[index - 1].order = temp;
            
            // Update the actual objects
            if (allItems[index].type === 'block') {
                allItems[index].item.order = allItems[index].order;
            } else {
                allItems[index].item.order = allItems[index].order;
            }
            
            if (allItems[index - 1].type === 'block') {
                allItems[index - 1].item.order = allItems[index - 1].order;
            } else {
                allItems[index - 1].item.order = allItems[index - 1].order;
            }
        }
    }

    moveItemDown(itemType, itemId) {
        const allItems = this.getAllOrderedItems();
        const index = allItems.findIndex(item => 
            item.type === itemType && 
            (itemType === 'block' ? item.item.id === itemId : item.item.id === itemId)
        );
        
        if (index < allItems.length - 1) {
            const temp = allItems[index].order;
            allItems[index].order = allItems[index + 1].order;
            allItems[index + 1].order = temp;
            
            // Update the actual objects
            if (allItems[index].type === 'block') {
                allItems[index].item.order = allItems[index].order;
            } else {
                allItems[index].item.order = allItems[index].order;
            }
            
            if (allItems[index + 1].type === 'block') {
                allItems[index + 1].item.order = allItems[index + 1].order;
            } else {
                allItems[index + 1].item.order = allItems[index + 1].order;
            }
        }
    }

    getAllOrderedItems() {
        const orderedItems = [];
        
        // Add ungrouped blocks
        this.blocks.filter(block => !block.groupId).forEach(block => {
            orderedItems.push({
                type: 'block',
                item: block,
                order: block.order || 0
            });
        });
        
        // Add groups
        this.groups.forEach((group, groupId) => {
            const groupBlocks = this.blocks.filter(block => block.groupId === groupId);
            if (groupBlocks.length > 0) {
                orderedItems.push({
                    type: 'group',
                    item: group,
                    blocks: groupBlocks,
                    order: group.order || 0
                });
            }
        });
        
        return orderedItems.sort((a, b) => a.order - b.order);
    }

    deleteBlock(blockId) {
        this.blocks = this.blocks.filter(b => b.id !== blockId);
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    groupSelectedBlocks() {
        const selectedBlocks = this.blocks.filter(block => block.selected && !block.groupId);
        if (selectedBlocks.length < 2) {
            alert('Please select at least 2 blocks to group');
            return;
        }

        const groupId = `group_${this.groupCounter++}`;
        const groupName = `Group ${this.groupCounter}`;
        
        // Get the minimum order from selected blocks to position the group
        const minOrder = Math.min(...selectedBlocks.map(block => block.order || 0));
        
        this.groups.set(groupId, {
            id: groupId,
            name: groupName,
            order: minOrder
        });

        selectedBlocks.forEach((block, index) => {
            block.groupId = groupId;
            block.selected = false;
            block.order = index; // Reset order within group
        });

        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    ungroupBlocks(groupId) {
        this.blocks.forEach(block => {
            if (block.groupId === groupId) {
                block.groupId = null;
            }
        });

        this.groups.delete(groupId);
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    deleteGroup(groupId) {
        this.blocks = this.blocks.filter(block => block.groupId !== groupId);
        this.groups.delete(groupId);
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    moveGroupUp(groupId) {
        this.moveItemUp('group', groupId);
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    moveGroupDown(groupId) {
        this.moveItemDown('group', groupId);
        this.renderAllContent();
        this.updatePreview();
        this.saveToStorage();
    }

    addTableRow(blockId) {
        const block = this.blocks.find(b => b.id === blockId);
        if (block && block.type === 'table') {
            const newRow = new Array(block.content.headers.length).fill('');
            block.content.rows.push(newRow);
            this.rerenderBlock(block);
            this.updatePreview();
            this.saveToStorage();
        }
    }

    addTableColumn(blockId) {
        const block = this.blocks.find(b => b.id === blockId);
        if (block && block.type === 'table') {
            block.content.headers.push('New Column');
            block.content.rows.forEach(row => row.push(''));
            this.rerenderBlock(block);
            this.updatePreview();
            this.saveToStorage();
        }
    }

    deleteTableRow(blockId, rowIndex) {
        const block = this.blocks.find(b => b.id === blockId);
        if (block && block.type === 'table' && block.content.rows.length > 1) {
            block.content.rows.splice(rowIndex, 1);
            this.rerenderBlock(block);
            this.updatePreview();
            this.saveToStorage();
        }
    }

    deleteTableColumn(blockId, colIndex) {
        const block = this.blocks.find(b => b.id === blockId);
        if (block && block.type === 'table' && block.content.headers.length > 1) {
            block.content.headers.splice(colIndex, 1);
            block.content.rows.forEach(row => row.splice(colIndex, 1));
            this.rerenderBlock(block);
            this.updatePreview();
            this.saveToStorage();
        }
    }

    rerenderBlock(block) {
        const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
        const contentContainer = blockElement.querySelector('.block-content');
        contentContainer.innerHTML = this.renderBlockContent(block);
        this.bindBlockEvents();
    }

    rerenderAllBlocks() {
        this.renderAllContent();
    }

    bindBlockEvents() {
        document.querySelectorAll('.block-input').forEach(input => {
            input.removeEventListener('input', this.handleBlockInput);
            input.addEventListener('input', this.handleBlockInput.bind(this));
        });

        document.querySelectorAll('.table-input').forEach(input => {
            input.removeEventListener('input', this.handleTableInput);
            input.addEventListener('input', this.handleTableInput.bind(this));
        });

        document.querySelectorAll('.block-select').forEach(checkbox => {
            checkbox.removeEventListener('change', this.handleBlockSelection);
            checkbox.addEventListener('change', this.handleBlockSelection.bind(this));
        });

        document.querySelectorAll('.group-name-input').forEach(input => {
            input.removeEventListener('input', this.handleGroupNameChange);
            input.addEventListener('input', this.handleGroupNameChange.bind(this));
        });
    }

    handleBlockSelection(e) {
        const blockId = e.target.dataset.blockId;
        const block = this.blocks.find(b => b.id === blockId);
        if (block) {
            block.selected = e.target.checked;
            this.saveToStorage();
        }
    }

    handleGroupNameChange(e) {
        const groupId = e.target.dataset.groupId;
        const group = this.groups.get(groupId);
        if (group) {
            group.name = e.target.value;
            this.saveToStorage();
        }
    }

    handleBlockInput(e) {
        const blockId = e.target.dataset.blockId;
        const block = this.blocks.find(b => b.id === blockId);
        if (block) {
            block.content = e.target.value;
            this.updatePreview();
            this.saveToStorage();
        }
    }

    handleTableInput(e) {
        const blockId = e.target.dataset.blockId;
        const row = parseInt(e.target.dataset.row);
        const col = parseInt(e.target.dataset.col);
        const block = this.blocks.find(b => b.id === blockId);
        
        if (block && block.type === 'table') {
            if (row === -1) {
                block.content.headers[col] = e.target.value;
            } else {
                block.content.rows[row][col] = e.target.value;
            }
            this.updatePreview();
            this.saveToStorage();
        }
    }

    addVariable(key = '', value = '') {
        const variableId = `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.variables.set(variableId, { key: key, value: value });
        this.renderVariables();
        this.updatePreview();
        this.saveToStorage();
    }

    renderVariables() {
        const container = document.getElementById('variables-list');
        container.innerHTML = '';
        
        this.variables.forEach((variable, id) => {
            const variableElement = document.createElement('div');
            variableElement.className = 'variable-item';
            variableElement.innerHTML = `
                <input type="text" class="variable-input" placeholder="Key" value="${variable.key}" data-variable-id="${id}" data-field="key">
                <input type="text" class="variable-input" placeholder="Value" value="${variable.value}" data-variable-id="${id}" data-field="value">
                <button class="delete-variable-btn" onclick="editor.deleteVariable('${id}')">🗑️</button>
            `;
            container.appendChild(variableElement);
        });

        this.bindVariableEvents();
    }

    bindVariableEvents() {
        document.querySelectorAll('.variable-input').forEach(input => {
            input.removeEventListener('input', this.handleVariableInput);
            input.addEventListener('input', this.handleVariableInput.bind(this));
        });
    }

    handleVariableInput(e) {
        const variableId = e.target.dataset.variableId;
        const field = e.target.dataset.field;
        const variable = this.variables.get(variableId);
        
        if (variable) {
            variable[field] = e.target.value;
            this.updatePreview();
            this.saveToStorage();
        }
    }

    deleteVariable(variableId) {
        this.variables.delete(variableId);
        this.renderVariables();
        this.updatePreview();
        this.saveToStorage();
    }

    substituteVariables(text) {
        let result = text;
        this.variables.forEach((variable) => {
            if (variable.key) {
                const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
                let value = variable.value;
                
                if (value.includes('{{') && value.includes('}}')) {
                    value = this.evaluateExpression(value);
                }
                
                result = result.replace(regex, value);
            }
        });
        return result;
    }

    evaluateExpression(expression) {
        let result = expression;
        
        this.variables.forEach((variable) => {
            if (variable.key && !variable.value.includes('{{')) {
                const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
                result = result.replace(regex, variable.value);
            }
        });

        try {
            const mathExpression = result.replace(/\{\{|\}\}/g, '');
            if (/^[\d\s+\-*/().]+$/.test(mathExpression)) {
                return eval(mathExpression).toString();
            }
        } catch (e) {
            // If evaluation fails, return original expression
        }
        
        return result;
    }

    generateMarkdown() {
        let markdown = '';
        
        // Get ordered items (blocks and groups) for consistent output
        const orderedItems = this.getAllOrderedItems();
        
        orderedItems.forEach(item => {
            if (item.type === 'block') {
                let content = '';
                
                if (item.item.type === 'table') {
                    content = this.generateTableMarkdown(item.item.content);
                } else {
                    content = item.item.content;
                }
                
                content = this.substituteVariables(content);
                markdown += content + '\n\n';
            } else if (item.type === 'group') {
                // Sort group blocks by their internal order
                const sortedGroupBlocks = item.blocks.sort((a, b) => (a.order || 0) - (b.order || 0));
                
                sortedGroupBlocks.forEach(block => {
                    let content = '';
                    
                    if (block.type === 'table') {
                        content = this.generateTableMarkdown(block.content);
                    } else {
                        content = block.content;
                    }
                    
                    content = this.substituteVariables(content);
                    markdown += content + '\n\n';
                });
            }
        });
        
        return markdown.trim();
    }

    generateTableMarkdown(tableData) {
        let markdown = '|';
        
        tableData.headers.forEach(header => {
            markdown += ` ${header} |`;
        });
        markdown += '\n|';
        
        tableData.headers.forEach(() => {
            markdown += ' --- |';
        });
        markdown += '\n';
        
        tableData.rows.forEach(row => {
            markdown += '|';
            row.forEach(cell => {
                markdown += ` ${cell} |`;
            });
            markdown += '\n';
        });
        
        return markdown;
    }

    updatePreview() {
        const previewContent = document.getElementById('preview-content');
        const markdown = this.generateMarkdown();
        previewContent.textContent = markdown;
    }

    copyToClipboard() {
        const markdown = this.generateMarkdown();
        navigator.clipboard.writeText(markdown).then(() => {
            const button = document.querySelector('.copy-btn');
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    }

    downloadMarkdown() {
        const markdown = this.generateMarkdown();
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    uploadFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.txt';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.importMarkdown(e.target.result);
                };
                reader.readAsText(file);
            }
        });
        input.click();
    }

    importMarkdown(markdown) {
        this.blocks = [];
        const lines = markdown.split('\n');
        let currentBlock = null;
        
        lines.forEach(line => {
            if (line.startsWith('#')) {
                this.finishCurrentBlock(currentBlock);
                currentBlock = { type: 'heading', content: line };
            } else if (line.startsWith('```')) {
                if (currentBlock && currentBlock.type === 'code') {
                    currentBlock.content += '\n' + line;
                    this.finishCurrentBlock(currentBlock);
                    currentBlock = null;
                } else {
                    this.finishCurrentBlock(currentBlock);
                    currentBlock = { type: 'code', content: line };
                }
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                if (currentBlock && currentBlock.type === 'list') {
                    currentBlock.content += '\n' + line;
                } else {
                    this.finishCurrentBlock(currentBlock);
                    currentBlock = { type: 'list', content: line };
                }
            } else if (line.trim() !== '') {
                if (currentBlock && currentBlock.type === 'paragraph') {
                    currentBlock.content += '\n' + line;
                } else if (currentBlock && (currentBlock.type === 'code' || currentBlock.type === 'list')) {
                    currentBlock.content += '\n' + line;
                } else {
                    this.finishCurrentBlock(currentBlock);
                    currentBlock = { type: 'paragraph', content: line };
                }
            }
        });
        
        this.finishCurrentBlock(currentBlock);
        this.rerenderAllBlocks();
        this.updatePreview();
        this.saveToStorage();
    }

    finishCurrentBlock(block) {
        if (block) {
            block.id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.blocks.push(block);
        }
    }

    saveToStorage() {
        const data = {
            blocks: this.blocks,
            variables: Array.from(this.variables.entries()),
            groups: Array.from(this.groups.entries()),
            groupCounter: this.groupCounter
        };
        localStorage.setItem('structuredMarkdownEditor', JSON.stringify(data));
    }

    loadFromStorage() {
        const data = localStorage.getItem('structuredMarkdownEditor');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.blocks = parsed.blocks || [];
                this.variables = new Map(parsed.variables || []);
                this.groups = new Map(parsed.groups || []);
                this.groupCounter = parsed.groupCounter || 0;
                
                // Initialize order property for existing blocks if missing
                this.blocks.forEach((block, index) => {
                    if (typeof block.order === 'undefined') {
                        block.order = index;
                    }
                    if (typeof block.selected === 'undefined') {
                        block.selected = false;
                    }
                });
                
                // Initialize order property for existing groups if missing
                let groupIndex = 0;
                this.groups.forEach((group) => {
                    if (typeof group.order === 'undefined') {
                        group.order = groupIndex++;
                    }
                });
                
                this.renderAllContent();
                this.renderVariables();
            } catch (e) {
                console.error('Failed to load from storage:', e);
            }
        } else {
            this.addVariable('product_name', 'Awesome Gadget');
            this.addVariable('release_date', '2024-10-26');
            this.addVariable('price', '1000');
            this.addVariable('tax', '0.2');
            this.addVariable('total', '{{price}}*{{tax}}');
            
            this.addBlock('heading');
            this.addBlock('paragraph');
            this.addBlock('table');
        }
    }
}

const editor = new StructuredMarkdownEditor();

document.addEventListener('DOMContentLoaded', () => {
    editor.bindBlockEvents();
});