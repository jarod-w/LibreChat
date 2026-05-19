import { preprocessNucleantMarkers } from '../nucleantMarkers';

describe('preprocessNucleantMarkers', () => {
  describe('progress', () => {
    it('renders started status as 进行中 blockquote', () => {
      const content =
        '<nucleant:progress>{"step":1,"total":1,"agent":"R1","label":"R1 · 行业扫描","status":"started","duration_ms":null,"retry_count":null,"provider_chain_used":null}</nucleant:progress>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('🔄 **R1 · 行业扫描** · 进行中');
      expect(result).not.toContain('<nucleant:');
    });

    it('renders done status with duration in seconds', () => {
      const content =
        '<nucleant:progress>{"step":1,"total":1,"agent":"R1","label":"R1 · 行业扫描","status":"done","duration_ms":44643,"retry_count":1,"provider_chain_used":null}</nucleant:progress>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('✅ **R1 · 行业扫描** · 完成 · 耗时 44.6s');
      expect(result).not.toContain('<nucleant:');
    });

    it('falls back to agent id when label is null', () => {
      const content =
        '<nucleant:progress>{"step":1,"total":1,"agent":"R1","label":null,"status":"done","duration_ms":1234}</nucleant:progress>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('✅ **R1** · 完成 · 耗时 1.2s');
    });

    it('uses ms unit when duration is sub-second', () => {
      const content =
        '<nucleant:progress>{"step":1,"total":1,"agent":"R1","label":"x","status":"done","duration_ms":523}</nucleant:progress>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('耗时 523ms');
    });
  });

  describe('report markers', () => {
    it('strips report_start entirely', () => {
      const content =
        'before <nucleant:report_start>{"mode":"template","forced_agent":"R1"}</nucleant:report_start> after';
      const result = preprocessNucleantMarkers(content);
      expect(result).toBe('before  after');
    });

    it('strips report_end entirely', () => {
      const content = '<nucleant:report_end>{"forced_agent":"R1"}</nucleant:report_end>';
      expect(preprocessNucleantMarkers(content)).toBe('');
    });
  });

  describe('error', () => {
    it('renders failed agent + detail', () => {
      const content =
        '<nucleant:error>{"code":"AGENT_LLM_FAILED","failed_agent":"R1","detail":"LLM 超时"}</nucleant:error>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('❌ **R1** · LLM 超时');
    });

    it('falls back to code when detail is empty', () => {
      const content =
        '<nucleant:error>{"code":"AGENT_LLM_FAILED","failed_agent":"R1","detail":""}</nucleant:error>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('❌ **R1** · AGENT_LLM_FAILED');
    });
  });

  describe('debate', () => {
    it('renders ok-status debate without trailing status', () => {
      const content =
        '<nucleant:debate>{"agent":"R1","round":"primary_draft","status":"ok"}</nucleant:debate>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('💭 R1 · primary_draft');
      expect(result).not.toContain(' · ok');
    });

    it('shows degraded status', () => {
      const content =
        '<nucleant:debate>{"agent":"R1","round":"critique_1","status":"degraded"}</nucleant:debate>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('💭 R1 · critique_1 · degraded');
    });
  });

  describe('clarify', () => {
    it('renders intent clarify line', () => {
      const content = '<nucleant:clarify>{"type":"intent"}</nucleant:clarify>';
      expect(preprocessNucleantMarkers(content)).toContain('❓ 请选择意图后继续');
    });

    it('renders fields clarify fallback line (empty missing_fields edge case)', () => {
      const content = '<nucleant:clarify>{"type":"fields"}</nucleant:clarify>';
      expect(preprocessNucleantMarkers(content)).toContain('❓ 请补充必要信息后继续');
    });

    it('fields with missing_fields still produce fallback text (FieldsForm component handles interactive rendering)', () => {
      const content =
        '<nucleant:clarify>{"type":"fields","missing_fields":[{"field":"brand_name","question":"您的品牌名称？","ui_type":"free_text"}]}</nucleant:clarify>';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('❓ 请补充必要信息后继续');
      expect(result).not.toContain('<nucleant:');
    });
  });

  describe('robustness', () => {
    it('returns input unchanged when no markers present', () => {
      const content = '# 普通报告\n\n这是正文,没有任何 marker。';
      expect(preprocessNucleantMarkers(content)).toBe(content);
    });

    it('handles empty content', () => {
      expect(preprocessNucleantMarkers('')).toBe('');
    });

    it('drops marker with malformed JSON without throwing', () => {
      const content = '<nucleant:progress>{not json</nucleant:progress>tail';
      const result = preprocessNucleantMarkers(content);
      expect(result).not.toContain('<nucleant:');
      expect(result).toContain('tail');
    });

    it('drops unknown marker kind', () => {
      const content = '<nucleant:unknown>{"x":1}</nucleant:unknown>visible';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('visible');
      expect(result).not.toContain('<nucleant:');
    });

    it('handles multiple sequential markers (the real-world scan流)', () => {
      const content =
        '<nucleant:progress>{"step":1,"total":1,"agent":"R1","label":"R1 · 行业扫描","status":"started"}</nucleant:progress>\n' +
        '<nucleant:progress>{"step":1,"total":1,"agent":"R1","label":null,"status":"done","duration_ms":44643,"retry_count":1}</nucleant:progress>\n' +
        '<nucleant:report_start>{"mode":"template","forced_agent":"R1"}</nucleant:report_start>\n' +
        '# 📊 行业扫描报告';
      const result = preprocessNucleantMarkers(content);
      expect(result).toContain('🔄 **R1 · 行业扫描** · 进行中');
      expect(result).toContain('✅ **R1** · 完成 · 耗时 44.6s');
      expect(result).toContain('# 📊 行业扫描报告');
      expect(result).not.toContain('<nucleant:');
      expect(result).not.toContain('report_start');
    });
  });
});
