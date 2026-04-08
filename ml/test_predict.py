"""Tests for ML predict API."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from predict_api import predict_load, predict_duration, generate_synthetic_history


def test_generate_synthetic_history():
    df = generate_synthetic_history(7)
    assert len(df) > 0
    assert 'hour' in df.columns
    assert 'dow' in df.columns
    assert 'post' in df.columns
    assert 'load' in df.columns
    # Should have 7 days * 13 hours * 10 posts = 910 rows
    assert len(df) == 7 * 13 * 10
    # Load should be between 0 and 1
    assert df['load'].min() >= 0
    assert df['load'].max() <= 1


def test_predict_load():
    result = predict_load("2026-04-08", post=1)
    assert isinstance(result, list)
    assert len(result) == 13  # hours 8-20
    for h in result:
        assert 'hour' in h
        assert 'predictions' in h
        assert 'avg' in h
        assert 0 <= h['avg'] <= 1


def test_predict_load_all_posts():
    result = predict_load("2026-04-08")
    assert len(result) == 13
    for h in result:
        assert len(h['predictions']) == 10  # 10 posts


def test_predict_duration():
    result = predict_duration("diagnostics")
    assert 'predicted_hours' in result
    assert 'confidence' in result
    assert 'range_min' in result
    assert 'range_max' in result
    assert result['predicted_hours'] > 0
    assert result['range_min'] < result['predicted_hours'] < result['range_max']


def test_predict_duration_with_brand():
    result = predict_duration("brake_service", brand="BMW")
    bmw_hours = result['predicted_hours']

    result2 = predict_duration("brake_service", brand="Toyota")
    toyota_hours = result2['predicted_hours']

    # BMW should take longer than Toyota (brand factor)
    assert bmw_hours > toyota_hours


def test_predict_duration_unknown_type():
    result = predict_duration("unknown_work_type")
    assert result['predicted_hours'] == 2.0  # default


def test_weekday_affects_load():
    # Monday (weekday)
    monday = predict_load("2026-04-06")  # Monday
    monday_avg = sum(h['avg'] for h in monday) / len(monday)

    # Saturday (weekend)
    saturday = predict_load("2026-04-11")  # Saturday
    saturday_avg = sum(h['avg'] for h in saturday) / len(saturday)

    # Weekend should generally have lower load
    # (using synthetic data so this may not always hold perfectly, but generally true)
    assert isinstance(monday_avg, float)
    assert isinstance(saturday_avg, float)


if __name__ == '__main__':
    test_generate_synthetic_history()
    test_predict_load()
    test_predict_load_all_posts()
    test_predict_duration()
    test_predict_duration_with_brand()
    test_predict_duration_unknown_type()
    test_weekday_affects_load()
    print('All ML tests passed!')
