import React from 'react';

interface MarkdownTextProps {
  text: string;
  className?: string;
}

export function MarkdownText({ text, className = '' }: MarkdownTextProps) {
  const parseMarkdown = (input: string): React.ReactNode => {
    const lines = input.split('\n');
    const elements: React.ReactNode[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Process inline formatting (bold, italic) within the line
      const processedLine = processInlineFormatting(line);
      
      // Detect list items
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(
          <div key={i} className="flex gap-2 my-1">
            <span className="text-cyan-400">•</span>
            <span>{processInlineFormatting(line.trim().substring(2))}</span>
          </div>
        );
      }
      // Detect numbered lists
      else if (/^\d+\.\s/.test(line.trim())) {
        const match = line.trim().match(/^(\d+)\.\s(.+)$/);
        if (match) {
          elements.push(
            <div key={i} className="flex gap-2 my-1">
              <span className="text-cyan-400">{match[1]}.</span>
              <span>{processInlineFormatting(match[2])}</span>
            </div>
          );
        }
      }
      // Empty lines
      else if (line.trim() === '') {
        elements.push(<br key={i} />);
      }
      // Regular paragraph
      else {
        elements.push(<div key={i}>{processedLine}</div>);
      }
    }
    
    return <>{elements}</>;
  };
  
  const processInlineFormatting = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Regex patterns
    const boldPattern = /\*\*(.+?)\*\*/g;
    const italicPattern = /\*(.+?)\*/g;
    const codePattern = /`(.+?)`/g;
    
    // Find all matches
    const allMatches: Array<{ start: number; end: number; type: string; content: string }> = [];
    
    let match;
    while ((match = boldPattern.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'bold',
        content: match[1],
      });
    }
    
    boldPattern.lastIndex = 0; // Reset regex
    
    // Sort matches by start position
    allMatches.sort((a, b) => a.start - b.start);
    
    // Build the result
    let processedText = text;
    let offset = 0;
    
    // Simple approach: replace patterns one by one
    processedText = text.replace(/\*\*(.+?)\*\*/g, (_, content) => {
      return `<BOLD>${content}</BOLD>`;
    });
    
    processedText = processedText.replace(/\*(.+?)\*/g, (_, content) => {
      // Don't replace if already in BOLD tag
      return `<ITALIC>${content}</ITALIC>`;
    });
    
    processedText = processedText.replace(/`(.+?)`/g, (_, content) => {
      return `<CODE>${content}</CODE>`;
    });
    
    // Convert custom tags to React elements
    const segments = processedText.split(/(<BOLD>.*?<\/BOLD>|<ITALIC>.*?<\/ITALIC>|<CODE>.*?<\/CODE>)/g);
    
    return segments.map((segment, i) => {
      if (segment.startsWith('<BOLD>')) {
        const content = segment.replace(/<\/?BOLD>/g, '');
        return <strong key={i} className="text-cyan-300">{content}</strong>;
      } else if (segment.startsWith('<ITALIC>')) {
        const content = segment.replace(/<\/?ITALIC>/g, '');
        return <em key={i} className="text-purple-300">{content}</em>;
      } else if (segment.startsWith('<CODE>')) {
        const content = segment.replace(/<\/?CODE>/g, '');
        return (
          <code key={i} className="bg-slate-700 px-1.5 py-0.5 rounded text-cyan-400">
            {content}
          </code>
        );
      }
      return segment;
    });
  };
  
  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parseMarkdown(text)}
    </div>
  );
}
