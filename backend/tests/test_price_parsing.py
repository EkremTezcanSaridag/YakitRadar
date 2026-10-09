"""Tests for price parsing functions."""
import pytest
from fiyat_servisi import (
    fiyat_parse,
    fiyat_format,
    liste_degeri,
    fiyat_degisimlerini_hesapla,
    degisim_ozeti,
)


class TestFiyatParse:
    """Tests for fiyat_parse function."""
    
    def test_parse_none(self):
        """Test parsing None value."""
        assert fiyat_parse(None) is None
    
    def test_parse_float(self):
        """Test parsing float value."""
        assert fiyat_parse(45.50) == 45.50
    
    def test_parse_int(self):
        """Test parsing integer value."""
        assert fiyat_parse(45) == 45.0
    
    def test_parse_turkish_format(self):
        """Test parsing Turkish price format with comma."""
        assert fiyat_parse("45,50") == 45.50
    
    def test_parse_with_tl_symbol(self):
        """Test parsing price with TL symbol."""
        assert fiyat_parse("45,50 TL") == 45.50
        assert fiyat_parse("45.50 ₺") == 45.50
    
    def test_parse_with_spaces(self):
        """Test parsing price with spaces."""
        assert fiyat_parse(" 45,50 ") == 45.50
    
    def test_parse_invalid(self):
        """Test parsing invalid value."""
        assert fiyat_parse("invalid") is None
        assert fiyat_parse("") is None


class TestFiyatFormat:
    """Tests for fiyat_format function."""
    
    def test_format_basic(self):
        """Test basic price formatting."""
        assert fiyat_format(45.50) == "45.50 TL"
    
    def test_format_with_rounding(self):
        """Test price formatting with rounding."""
        assert fiyat_format(45.123) == "45.12 TL"
    
    def test_format_integer(self):
        """Test formatting integer as price."""
        assert fiyat_format(45) == "45.00 TL"


class TestListeDegeri:
    """Tests for liste_degeri function."""
    
    def test_list_input(self):
        """Test with list input."""
        result = liste_degeri(["istanbul", "ankara", "izmir"])
        assert result == ["istanbul", "ankara", "izmir"]
    
    def test_list_with_empty(self):
        """Test list filtering empty values."""
        result = liste_degeri(["istanbul", "", None, "ankara"])
        assert result == ["istanbul", "ankara"]
    
    def test_json_string_input(self):
        """Test with JSON string input."""
        result = liste_degeri('["istanbul", "ankara"]')
        assert result == ["istanbul", "ankara"]
    
    def test_plain_string_input(self):
        """Test with plain string input."""
        result = liste_degeri("istanbul")
        assert result == ["istanbul"]
    
    def test_invalid_json(self):
        """Test with invalid JSON string."""
        result = liste_degeri("not a json")
        assert result == ["not a json"]


class TestFiyatDegisimleriniHesapla:
    """Tests for fiyat_degisimlerini_hesapla function."""
    
    def test_no_previous_prices(self):
        """Test when there are no previous prices."""
        yeni = {
            "İstanbul": {
                "benzin_95": "45,50",
                "motorin": "46,20",
                "lpg": "25,30"
            }
        }
        result = fiyat_degisimlerini_hesapla({}, yeni)
        assert result == []
    
    def test_price_increase(self):
        """Test detecting price increase."""
        onceki = {
            "İstanbul": {
                "benzin_95": "45,00",
                "motorin": "46,00",
                "lpg": "25,00"
            }
        }
        yeni = {
            "İstanbul": {
                "benzin_95": "45,50",
                "motorin": "46,20",
                "lpg": "25,30"
            }
        }
        result = fiyat_degisimlerini_hesapla(onceki, yeni)
        
        assert len(result) == 3
        assert all(d["direction"] == "increase" for d in result)
        assert all(d["city"] == "İstanbul" for d in result)
    
    def test_price_decrease(self):
        """Test detecting price decrease."""
        onceki = {
            "Ankara": {
                "benzin_95": "46,00",
                "motorin": "47,00",
                "lpg": "26,00"
            }
        }
        yeni = {
            "Ankara": {
                "benzin_95": "45,50",
                "motorin": "46,50",
                "lpg": "25,50"
            }
        }
        result = fiyat_degisimlerini_hesapla(onceki, yeni)
        
        assert len(result) == 3
        assert all(d["direction"] == "decrease" for d in result)
    
    def test_no_significant_change(self):
        """Test filtering out insignificant changes."""
        onceki = {
            "İzmir": {
                "benzin_95": "45,00",
                "motorin": "46,00",
                "lpg": "25,00"
            }
        }
        yeni = {
            "İzmir": {
                "benzin_95": "45,002",  # Less than 0.01 TL change after rounding
                "motorin": "46,00",
                "lpg": "25,00"
            }
        }
        result = fiyat_degisimlerini_hesapla(onceki, yeni)
        # Due to rounding, very small changes might still register
        # The important thing is that changes < 0.01 TL are filtered
        for change in result:
            assert abs(change["diff"]) >= 0.01 or abs(change["diff"]) < 0.001
    
    def test_unreasonable_change_filtered(self):
        """Test filtering out unreasonable price changes."""
        onceki = {
            "Bursa": {
                "benzin_95": "45,00",
                "motorin": "46,00",
                "lpg": "25,00"
            }
        }
        yeni = {
            "Bursa": {
                "benzin_95": "100,00",  # More than 8 TL change
                "motorin": "46,20",
                "lpg": "25,10"
            }
        }
        result = fiyat_degisimlerini_hesapla(onceki, yeni)
        
        # The unreasonable benzin change should be filtered
        assert all(d["fuel"] != "Benzin" for d in result)
    
    def test_sorted_by_magnitude(self):
        """Test results are sorted by change magnitude."""
        onceki = {
            "İstanbul": {"benzin_95": "45,00", "motorin": "46,00", "lpg": "25,00"},
            "Ankara": {"benzin_95": "44,00", "motorin": "45,00", "lpg": "24,00"}
        }
        yeni = {
            "İstanbul": {"benzin_95": "45,10", "motorin": "46,50", "lpg": "25,05"},
            "Ankara": {"benzin_95": "44,20", "motorin": "45,80", "lpg": "24,10"}
        }
        result = fiyat_degisimlerini_hesapla(onceki, yeni)
        
        # Should be sorted by absolute diff value
        for i in range(len(result) - 1):
            assert abs(result[i]["diff"]) >= abs(result[i + 1]["diff"])


class TestDegisimOzeti:
    """Tests for degisim_ozeti function."""
    
    def test_basic_summary(self):
        """Test basic change summary."""
        degisimler = [
            {
                "city": "İstanbul",
                "fuel": "Benzin",
                "diff": 0.50,
                "old_price": 45.00,
                "new_price": 45.50,
            },
            {
                "city": "Ankara",
                "fuel": "Motorin",
                "diff": -0.20,
                "old_price": 46.00,
                "new_price": 45.80,
            }
        ]
        result = degisim_ozeti(degisimler, limit=8)
        
        assert len(result) == 2
        assert result[0]["city"] == "İstanbul"
        assert result[0]["fuel"] == "Benzin"
        assert result[0]["diff"] == 0.50
        assert result[0]["source"] == "price_change"
    
    def test_limit_respected(self):
        """Test that limit parameter is respected."""
        degisimler = [
            {"city": f"City{i}", "fuel": "Benzin", "diff": 0.10 * i, "old_price": 45, "new_price": 45 + 0.10 * i}
            for i in range(20)
        ]
        result = degisim_ozeti(degisimler, limit=5)
        assert len(result) == 5
    
    def test_empty_changes(self):
        """Test with empty changes list."""
        result = degisim_ozeti([])
        assert result == []
