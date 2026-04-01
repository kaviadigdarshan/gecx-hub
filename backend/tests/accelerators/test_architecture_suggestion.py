"""Unit tests for architecture suggestion service and prompt templates."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestArchitectureSuggestion:

    @pytest.mark.asyncio
    async def test_returns_architecture_suggestion(self, sample_use_case, mock_architecture_gemini):
        from services.architecture_service import suggest_architecture
        from models.accelerators.scaffolder import ArchitectureSuggestRequest
        request = ArchitectureSuggestRequest(use_case=sample_use_case)
        result = await suggest_architecture(request)
        assert result.agents is not None
        assert len(result.agents) >= 1

    @pytest.mark.asyncio
    async def test_always_has_exactly_one_root_agent(self, sample_use_case, mock_architecture_gemini):
        from services.architecture_service import suggest_architecture
        from models.accelerators.scaffolder import ArchitectureSuggestRequest
        request = ArchitectureSuggestRequest(use_case=sample_use_case)
        result = await suggest_architecture(request)
        root_agents = [a for a in result.agents if a.agent_type == "root_agent"]
        assert len(root_agents) == 1

    @pytest.mark.asyncio
    async def test_returns_rationale(self, sample_use_case, mock_architecture_gemini):
        from services.architecture_service import suggest_architecture
        from models.accelerators.scaffolder import ArchitectureSuggestRequest
        request = ArchitectureSuggestRequest(use_case=sample_use_case)
        result = await suggest_architecture(request)
        assert result.rationale
        assert len(result.rationale) > 0

    @pytest.mark.asyncio
    async def test_handles_malformed_gemini_response_gracefully(self, sample_use_case):
        from services.architecture_service import suggest_architecture
        from models.accelerators.scaffolder import ArchitectureSuggestRequest
        from fastapi import HTTPException
        with patch("services.architecture_service.get_gemini_service") as mock:
            service = MagicMock()
            service.generate_structured_json = AsyncMock(return_value={"invalid": "response"})
            mock.return_value = service
            request = ArchitectureSuggestRequest(use_case=sample_use_case)
            with pytest.raises(HTTPException) as exc:
                await suggest_architecture(request)
            assert exc.value.status_code == 422

    def test_get_architecture_suggestion_prompt_includes_use_case(self, sample_use_case):
        from templates.scaffolder.architecture_prompts import get_architecture_suggestion_prompt
        prompt = get_architecture_suggestion_prompt(sample_use_case.model_dump())
        assert sample_use_case.business_domain in prompt
        assert sample_use_case.primary_use_case in prompt

    def test_get_architecture_suggestion_prompt_includes_capabilities(self, sample_use_case):
        from templates.scaffolder.architecture_prompts import get_architecture_suggestion_prompt
        prompt = get_architecture_suggestion_prompt(sample_use_case.model_dump())
        for cap in sample_use_case.expected_capabilities:
            assert cap in prompt

    def test_instruction_scaffold_prompt_includes_agent_name(self, sample_agents, sample_use_case):
        from templates.scaffolder.architecture_prompts import get_instruction_scaffold_prompt
        agent = sample_agents[1]
        prompt = get_instruction_scaffold_prompt(
            agent.model_dump(), sample_use_case.model_dump(),
            [a.model_dump() for a in sample_agents]
        )
        assert agent.name in prompt

    def test_root_agent_prompt_includes_sub_agent_names(self, sample_agents, sample_use_case):
        from templates.scaffolder.architecture_prompts import get_instruction_scaffold_prompt
        root = sample_agents[0]
        prompt = get_instruction_scaffold_prompt(
            root.model_dump(), sample_use_case.model_dump(),
            [a.model_dump() for a in sample_agents]
        )
        # Should reference sub-agent names for delegation
        assert sample_agents[1].name in prompt or sample_agents[2].name in prompt
